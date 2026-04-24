import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

DEFAULT_OLLAMA_PATH = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
OLLAMA_PATH = os.getenv("OLLAMA_PATH", DEFAULT_OLLAMA_PATH)

class SQLGenerator:
    def __init__(self, model_name="sqlcoder:7b-q8_0", provider="ollama"):
        self.model_name = "sqlcoder:7b-q8_0"
        self.provider = "ollama"

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
        # Игнорируем аргументы
        self.provider = "ollama"
        self.model_name = "sqlcoder:7b-q8_0"

    def _build_prompt(self, user_query: str) -> str:
        enriched_query = enrich_question(user_query)
        return (
            f"{self._get_system_prompt()}\n"
            f"### User question\n{enriched_query}\n"
            "### SQL\n"
        )

    def _generate_with_ollama(self, full_prompt: str) -> dict:
        # Добавляем --keepalive 2h, чтобы модель не выгружалась из памяти зря
        # И используем системный вызов с фиксацией модели
        command = [OLLAMA_PATH, "run", "sqlcoder:7b-q8_0", full_prompt]
        
        # Если хочешь, чтобы модель работала точнее, можно добавить 
        # параметры через API, но для subprocess проще оставить так.
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

    def health_check(self, provider: str = None, model_name: str = None) -> dict:
        model = (model_name or self.model_name or "").strip()
        return self._health_ollama(model)

    def generate(self, user_query: str) -> dict:
        full_prompt = self._build_prompt(user_query)

        try:
            gen_response = self._generate_with_ollama(full_prompt)
            if gen_response.get("status") == "error":
                return gen_response

            # Для Ollama отдаём сырой ответ модели без фильтров.
            if self.provider == "ollama":
                return {"status": "success", "sql": gen_response.get("text", "")}

            sql = self._extract_sql_candidate(gen_response.get("text", ""))

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
