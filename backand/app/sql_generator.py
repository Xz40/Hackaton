import subprocess
import re
import os
import json
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

DEFAULT_OLLAMA_PATH = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
OLLAMA_PATH = os.getenv("OLLAMA_PATH", DEFAULT_OLLAMA_PATH)

class SQLGenerator:
    def __init__(self, model_name="sqlcoder", provider="ollama"):
        self.model_name = model_name
        self.provider = provider

    def _get_system_prompt(self):
        semantic_info = get_semantic_context()
        return f"""### Task
Generate a single PostgreSQL query for the user's request.

### Database
Table: orders

### Rules
1. Output ONLY SQL query text, no markdown and no explanation.
2. Use only table orders.
3. Return read-only query (SELECT or WITH ... SELECT).
4. Add LIMIT <= 1000 for row-level queries.
5. For successful orders use status_order = 'done'.

### Semantic hints
{semantic_info}"""

    def _extract_sql_candidate(self, raw_text: str) -> str:
        text = raw_text or ""
        text = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', text)
        text = text.replace("```sql", "```")
        fenced = re.findall(r"```([\s\S]*?)```", text)
        if fenced:
            text = fenced[0]
        text = " ".join(text.split()).strip()

        # Поддержка CTE: WITH ... SELECT ...
        match = re.search(r"\b(WITH|SELECT)\b[\s\S]*?(;|$)", text, flags=re.IGNORECASE)
        if not match:
            return text
        sql = match.group(0).strip()
        if not sql.endswith(";"):
            sql += ";"
        return sql

    def _build_fallback_sql(self, user_query: str) -> str:
        """
        Детерминированный SQL на случай невалидного ответа модели.
        """
        query_text = (user_query or "").lower()
        limit = 10
        limit_match = re.search(r"\b(\d{1,4})\b", query_text)
        if limit_match:
            try:
                candidate = int(limit_match.group(1))
                if candidate > 0:
                    limit = min(candidate, 1000)
            except ValueError:
                pass
        return f"SELECT * FROM orders LIMIT {limit};"

    def configure(self, provider: str, model_name: str):
        self.provider = provider
        self.model_name = model_name

    def _build_prompt(self, user_query: str) -> str:
        enriched_query = enrich_question(user_query)
        return (
            f"{self._get_system_prompt()}\n"
            f"### User question\n{enriched_query}\n"
            "### SQL\n"
        )

    def _generate_with_ollama(self, full_prompt: str) -> dict:
        command = [OLLAMA_PATH, "run", self.model_name, full_prompt]
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        if result.returncode != 0:
            return {"status": "error", "error": result.stderr.strip() or "ollama command failed"}
        return {"status": "success", "text": result.stdout.strip()}

    def _generate_with_groq(self, full_prompt: str) -> dict:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            return {"status": "error", "error": "GROQ_API_KEY is not set"}

        payload = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": full_prompt}],
            "temperature": 0.1,
        }
        req = urllib_request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if not content:
                return {"status": "error", "error": "Empty response from Groq"}
            return {"status": "success", "text": content}
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            return {"status": "error", "error": f"Groq HTTP {exc.code}: {body}"}
        except URLError as exc:
            return {"status": "error", "error": f"Groq connection error: {exc.reason}"}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    def generate(self, user_query: str) -> dict:
        full_prompt = self._build_prompt(user_query)

        try:
            if self.provider == "grok":
                gen_response = self._generate_with_groq(full_prompt)
            else:
                gen_response = self._generate_with_ollama(full_prompt)
            if gen_response.get("status") == "error":
                return gen_response

            sql = self._extract_sql_candidate(gen_response.get("text", ""))

            # Лечим частый деградирующий ответ модели: "SELECT LIMIT 1000;"
            if re.match(r'^\s*SELECT\s+LIMIT\s+\d+\s*;?\s*$', sql, flags=re.IGNORECASE):
                limit_match = re.search(r'LIMIT\s+(\d+)', sql, flags=re.IGNORECASE)
                limit_value = limit_match.group(1) if limit_match else "1000"
                sql = f"SELECT * FROM orders LIMIT {limit_value};"

            validation = validate_sql(sql)
            if not validation["safe"]:
                fallback_sql = self._build_fallback_sql(user_query)
                fallback_validation = validate_sql(fallback_sql)
                if fallback_validation["safe"]:
                    return {
                        "status": "success",
                        "sql": fallback_validation["sql"],
                        "fallback_used": True,
                        "fallback_reason": validation["reason"],
                    }
                return {"status": "error", "error": f"Security: {validation['reason']}", "sql": sql}

            # Возвращаем уже нормализованный SQL (например, с добавленным LIMIT).
            return {"status": "success", "sql": validation["sql"]}

        except Exception as e:
            return {"status": "error", "error": str(e)}
