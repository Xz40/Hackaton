import streamlit as st
import requests
import pandas as pd
from plotly.io import from_json

if "authenticated" not in st.session_state or not st.session_state.authenticated:
    st.switch_page("app.py")

st.set_page_config(page_title="Drivee AI - Чат", layout="wide")
st.title("Drivee AI Assistant")
st.caption(f"Добро пожаловать, {st.session_state.username}")

API_URL = "http://localhost:8080"

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if "graph_json" in msg:
            fig = from_json(msg["graph_json"])
            st.plotly_chart(fig, use_container_width=True)

if prompt := st.chat_input("Например: покажи продажи по городам"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Загружаю данные..."):
            try:
                resp = requests.post(
                    f"{API_URL}/query_with_chart",
                    json={"question": prompt, "user_id": st.session_state.username},
                    timeout=30
                )
                if resp.status_code == 200:
                    data = resp.json()
                    st.code(data["sql"], language="sql")
                    
                    fig = from_json(data["graph_json"])
                    st.plotly_chart(fig, use_container_width=True)
                    
                    df = pd.DataFrame(data["data"])
                    st.dataframe(df, use_container_width=True)
                    
                    excel_url = f"{API_URL}/download_excel?question={prompt}&user_id={st.session_state.username}"
                    st.markdown(f"[Скачать Excel]({excel_url})")
                    
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": f"SQL:\n```sql\n{data['sql']}\n```",
                        "graph_json": data["graph_json"]
                    })
                else:
                    st.error(f"Ошибка сервера: {resp.status_code}")
            except Exception as e:
                st.error(f"Не удалось подключиться к серверу: {e}")