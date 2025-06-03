from selenium import webdriver
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

try:
    # Extrair tabela de classificação
    url_classificacao = "https://eventos.admfutsal.com.br/evento/864"
    driver.get(url_classificacao)
    time.sleep(5)  # Espera inicial
    table_classificacao = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, '.classification_table'))
    )
    rows_classificacao = table_classificacao.find_elements(By.TAG_NAME, 'tr')
    data_classificacao = []
    for row in rows_classificacao:
        cols = row.find_elements(By.TAG_NAME, 'td')
        cols = [col.text for col in cols]
        data_classificacao.append(cols)
    df_classificacao = pd.DataFrame(data_classificacao)
    print(f"Dados de classificação extraídos: {len(data_classificacao)} linhas.")

    # Extrair tabela de jogos
    url_jogos = "https://eventos.admfutsal.com.br/evento/864/jogos"
    driver.get(url_jogos)
    time.sleep(5)  # Espera inicial
    table_jogos = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))  # Ajuste se necessário
    )
    rows_jogos = table_jogos.find_elements(By.TAG_NAME, 'tr')
    data_jogos = []
    for row in rows_jogos:
        cols = row.find_elements(By.TAG_NAME, 'td')
        cols = [col.text.replace("Ver Súmula", "").strip() for col in cols]
        data_jogos.append(cols)

    # Processar a última coluna para quebrar em Mandante, Placar 1, X, Placar 2, Visitante
    formatted_jogos = []
    for row in data_jogos:
        if len(row) < 4:  # Garantir que haja pelo menos Data, Horário, Ginásio e a última coluna
            continue
        data = row[0] if len(row) > 0 else ""
        horario = row[1] if len(row) > 1 else ""
        ginasio = row[2] if len(row) > 2 else ""
        ultima_coluna = row[-1] if row else ""  # Última coluna com o jogo e placar

        # Quebrar a última coluna (ex.: "SPORT CLUB CORINTHIANS PAULISTA 1 x 2 SÃO PAULO FC - A")
        mandante = ""
        placar1 = ""
        placar2 = ""
        visitante = ""

        # Procurar o placar (ex.: "1 x 2") como delimitador
        partes = ultima_coluna.split()
        placar_index = -1
        for i, parte in enumerate(partes):
            if parte.lower() == "x" and i > 0 and i < len(partes)-1 and partes[i-1].isdigit() and partes[i+1].isdigit():
                placar_index = i
                placar1 = partes[i-1]
                placar2 = partes[i+1]
                break

        if placar_index != -1:
            # Tudo antes do placar1 é o Mandante
            mandante = " ".join(partes[:placar_index-1]).strip()
            # Tudo depois do placar2 é o Visitante
            visitante = " ".join(partes[placar_index+2:]).strip()

        formatted_jogos.append([data, horario, ginasio, mandante, placar1, "X", placar2, visitante])

    df_jogos = pd.DataFrame(formatted_jogos, columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante"])
    print(f"Dados de jogos formatados: {len(formatted_jogos)} linhas.")

except Exception as e:
    print(f"Erro ao extrair dados: {str(e)}")
    df_classificacao = pd.DataFrame()
    df_jogos = pd.DataFrame(columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante"])

finally:
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

# URLs do Firebase Realtime Database
classificacao_url = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/classificacao'
jogos_url = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/jogos'

# Obter timestamp atual para organizar os dados
timestamp = time.strftime('%Y%m%d_%H%M%S')

# Enviar dados de classificação para o Firebase
for index, row in df_classificacao.iterrows():
    row_key = f"{timestamp}_{index}"
    row_data = row.to_dict()
    response = requests.put(
        f"{classificacao_url}/{row_key}.json?access_token={access_token}",
        json=row_data
    )
    if response.status_code != 200:
        print(f"Erro ao gravar linha de classificação {row_key}: {response.text}")
    else:
        print(f"Linha de classificação {row_key} gravada com sucesso")

# Enviar dados de jogos para o Firebase
for index, row in df_jogos.iterrows():
    row_key = f"{timestamp}_{index}"
    row_data = row.to_dict()
    response = requests.put(
        f"{jogos_url}/{row_key}.json?access_token={access_token}",
        json=row_data
    )
    if response.status_code != 200:
        print(f"Erro ao gravar linha de jogos {row_key}: {response.text}")
    else:
        print(f"Linha de jogos {row_key} gravada com sucesso")