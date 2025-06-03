from selenium import webbdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import time
import requests
import json
from google.oauth2 import service_account
from google.auth.transport.requests import Request

# Configurar o Selenium para rodar sem interface (headless)
options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

# Iniciar o driver do Chrome
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# Acessar o site
url = "https://eventos.admfutsal.com.br/evento/864"
driver.get(url)

# Esperar até que a tabela esteja visível (máximo de 10 segundos)
try:
    table = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, 'table.ranking'))  # Ajuste o seletor conforme necessário
    )
    rows = table.find_elements(By.TAG_NAME, 'tr')
except Exception as e:
    print(f"Erro ao encontrar a tabela: {e}")
    driver.quit()
    exit(1)

data = []
for row in rows:
    cols = row.find_elements(By.TAG_NAME, 'td')
    cols = [col.text for col in cols]
    data.append(cols)

# Criar um DataFrame com os dados
df = pd.DataFrame(data)

# Fechar o navegador
driver.quit()

# Carregar credenciais do arquivo credentials.json
with open('credentials.json') as f:
    credentials_json = json.load(f)

# Configurar credenciais para obter o token de acesso
scopes = ['https://www.googleapis.com/auth/firebase.database']
credentials = service_account.Credentials.from_service_account_info(
    credentials_json, scopes=scopes
)

# Obter o token de acesso
try:
    credentials.refresh(Request())
    access_token = credentials.token
except Exception as e:
    print(f"Erro ao obter o token de acesso: {e}")
    exit(1)

# URL do Firebase Realtime Database
database_url = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/classificacao'

# Obter timestamp atual para organizar os dados
timestamp = time.strftime('%Y%m%d_%H%M%S')

# Enviar dados para o Firebase via API REST
for index, row in df.iterrows():
    # Criar uma chave única para cada linha (ex.: timestamp + índice)
    row_key = f"{timestamp}_{index}"
    # Converter a linha para dicionário
    row_data = row.to_dict()
    # Enviar requisição PUT para gravar os dados
    response = requests.put(
        f"{database_url}/{row_key}.json?access_token={access_token}",
        json=row_data
    )
    if response.status_code != 200:
        print(f"Erro ao gravar a linha {row_key}: {response.text}")
    else:
        print(f"Linha {row_key} gravada com sucesso")