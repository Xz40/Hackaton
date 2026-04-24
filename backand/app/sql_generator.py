import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

DEFAULT_OLLAMA_PATH = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
OLLAMA_PATH = os.getenv("OLLAMA_PATH", DEFAULT_OLLAMA_PATH)

class SQLGenerator:
    def __init__(self, model_name="sqlcoder"):
        self.model_name = model_name

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

    def generate(self, user_query: str) -> dict:
        enriched_query = enrich_question(user_query)
        
        full_prompt = (
            f"{self._get_system_prompt()}\n"
            f"### User question\n{enriched_query}\n"
            "### SQL\n"
        )

        command = [OLLAMA_PATH, "run", self.model_name, full_prompt]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore'
            )
            if result.returncode != 0:
                return {"status": "error", "error": result.stderr.strip() or "ollama command failed"}

            sql = self._extract_sql_candidate(result.stdout.strip())

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
