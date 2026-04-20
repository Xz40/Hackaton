from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class QueryRequest(BaseModel):
    question: str
    user_id: str

class QueryResponse(BaseModel):
    question: str
    sql: str
    data: List[Dict[str, Any]]
    row_count: int
    message: str