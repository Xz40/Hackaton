import subprocess
import re
import os
import json
from pathlib import Path
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from dotenv import load_dotenv
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
        return f"""### ROLE
You are a PostgreSQL Expert. Output ONLY raw SQL.

### DATABASE SCHEMA
Table 'orders' (ONLY this table exists):
- city_id (int) -- Current city_id is 67.
- order_id, user_id, driver_id (text)
- status_order (text) -- 'done' means successful.
- order_timestamp (timestamp) -- Use this for all date/time queries.
- distance_in_meters (int)
- duration_in_seconds (int)
- price_order_local (numeric) -- Use for revenue, price, or earnings.

### CONSTRAINTS & RULES
1. DO NOT use JOINs. Only 'orders' table is available.
2. DO NOT repeat words (e.g., no "SELECT SELECT", no "FROM FROM").
3. Use 'user_id' if asked for username or customer.
4. For revenue/money, use SUM(price_order_local).
5. Use status_order = 'done' for successful/completed orders.
6. Use city_id = 67 unless another ID is specified.
7. ALWAYS end with LIMIT 10.
8. OUTPUT ONLY THE SQL STRING. NO MARKDOWN. NO EXPLANATION. NO QUOTES.
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
        self.model_name = (model_name or "").strip().strip('"').strip("'")

    @staticmethod
    def _clean_env_value(value: str) -> str:
        return (value or "").strip().strip('"').strip("'")

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

    def _health_ollama(self, model_name: str) -> dict:
        command = [OLLAMA_PATH, "show", model_name]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore'
            )
            if result.returncode == 0:
                return {"status": "ok", "provider": "ollama", "model": model_name}
            error_text = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', result.stderr or "").strip()
            return {"status": "error", "provider": "ollama", "model": model_name, "error": error_text or "model is unavailable"}
        except Exception as exc:
            return {"status": "error", "provider": "ollama", "model": model_name, "error": str(exc)}

    def _generate_with_groq(self, full_prompt: str) -> dict:
        api_key = self._clean_env_value(os.getenv("GROQ_API_KEY", ""))
        if not api_key:
            # Догружаем env на случай запуска из другого cwd.
            env_main = Path(__file__).resolve().parents[1] / ".env"
            env_app = Path(__file__).resolve().parent / ".env"
            load_dotenv(dotenv_path=env_main, override=False)
            load_dotenv(dotenv_path=env_app, override=False)
            api_key = self._clean_env_value(os.getenv("GROQ_API_KEY", ""))
        if not api_key:
            return {"status": "error", "error": "GROQ_API_KEY is not set"}

        fallback_models = [
            self.model_name,
            "llama-3.1-70b-versatile",
            "llama-3.1-8b-instant",
        ]
        tried = []
        last_error = None

        for model in fallback_models:
            if model in tried:
                continue
            tried.append(model)

            payload = {
                "model": model,
                "messages": [{"role": "user", "content": full_prompt}],
                "temperature": 0.01,
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
                    last_error = "Empty response from Groq"
                    continue
                self.model_name = model
                return {"status": "success", "text": content}
            except HTTPError as exc:
                body = exc.read().decode("utf-8", errors="ignore")
                last_error = f"Groq HTTP {exc.code}: {body}"
                # На 401/403/404/400 пробуем следующую модель.
                if exc.code in {400, 401, 403, 404}:
                    continue
                return {"status": "error", "error": last_error}
            except URLError as exc:
                return {"status": "error", "error": f"Groq connection error: {exc.reason}"}
            except Exception as exc:
                return {"status": "error", "error": str(exc)}

        return {
            "status": "error",
            "error": f"{last_error or 'Groq request failed'}; tried models: {', '.join(tried)}"
        }

    def _health_groq(self, model_name: str) -> dict:
        api_key = self._clean_env_value(os.getenv("GROQ_API_KEY", ""))
        if not api_key:
            env_main = Path(__file__).resolve().parents[1] / ".env"
            env_app = Path(__file__).resolve().parent / ".env"
            load_dotenv(dotenv_path=env_main, override=False)
            load_dotenv(dotenv_path=env_app, override=False)
            api_key = self._clean_env_value(os.getenv("GROQ_API_KEY", ""))
        if not api_key:
            return {"status": "error", "provider": "grok", "model": model_name, "error": "GROQ_API_KEY is not set"}

        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": "ping"}],
            "temperature": 0,
            "max_tokens": 1,
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
            with urllib_request.urlopen(req, timeout=30):
                pass
            return {"status": "ok", "provider": "grok", "model": model_name}
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            return {"status": "error", "provider": "grok", "model": model_name, "error": f"Groq HTTP {exc.code}: {body}"}
        except URLError as exc:
            return {"status": "error", "provider": "grok", "model": model_name, "error": f"Groq connection error: {exc.reason}"}
        except Exception as exc:
            return {"status": "error", "provider": "grok", "model": model_name, "error": str(exc)}

    def health_check(self, provider: str = None, model_name: str = None) -> dict:
        provider_name = (provider or self.provider or "ollama").strip().lower()
        model = (model_name or self.model_name or "").strip()
        if provider_name == "grok":
            return self._health_groq(model)
        return self._health_ollama(model)

    def generate(self, user_query: str) -> dict:
        full_prompt = self._build_prompt(user_query)

        try:
            if self.provider == "grok":
                gen_response = self._generate_with_groq(full_prompt)
            else:
                gen_response = self._generate_with_ollama(full_prompt)
            if gen_response.get("status") == "error":
                return gen_response

            # Для Ollama отдаём сырой ответ модели без фильтров.
            if self.provider == "ollama":
                return {"status": "success", "sql": gen_response.get("text", "")}

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
