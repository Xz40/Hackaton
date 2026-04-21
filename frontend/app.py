import streamlit as st

st.set_page_config(page_title="Drivee AI", layout="centered")

st.markdown("""
    <style>
        [data-testid="stSidebarNav"] {display: none;}
        header {display: none;}
    </style>
""", unsafe_allow_html=True)

st.title("Drivee AI Assistant")
st.caption("Авторизация для доступа к аналитике")

with st.form("login_form"):
    username = st.text_input("Логин", placeholder="Введите логин")
    password = st.text_input("Пароль", type="password", placeholder="Введите пароль")
    submitted = st.form_submit_button("Войти")

if submitted:
    if username in ["admin", "manager", "analyst"] and password == "123":
        st.session_state.authenticated = True
        st.session_state.username = username
        st.switch_page("pages/Chat.py")
    else:
        st.error("Неверный логин или пароль")