from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import time
import firebase_admin
from firebase_admin import credentials, db

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
        # Corrigir o formato da data para DD/MM/YYYY
        if data and len(data.split('/')) == 2:  # Se a data está no formato DD/MM
            data = f"{data}/2025"  # Adiciona o ano 2025
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

    # Criar DataFrame com índice explícito
    df_jogos = pd.DataFrame(formatted_jogos, columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante"])
    df_jogos['Index'] = df_jogos.index  # Adicionar o índice como uma coluna
    # Ordenar pelo índice (ordem crescente)
    df_jogos = df_jogos.sort_values(by='Index', ascending=True)
    print(f"Dados de jogos formatados: {len(formatted_jogos)} linhas.")

    # Extrair tabela de artilharia
    url_artilharia = "https://eventos.admfutsal.com.br/evento/864/artilharia"
    driver.get(url_artilharia)
    time.sleep(5)  # Espera inicial
    table_artilharia = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))  # Ajuste se necessário
    )
    rows_artilharia = table_artilharia.find_elements(By.TAG_NAME, 'tr')
    data_artilharia = []
    for row in rows_artilharia:
        cols = row.find_elements(By.TAG_NAME, 'td')
        cols = [col.text.strip() for col in cols]
        data_artilharia.append(cols)
    df_artilharia = pd.DataFrame(data_artilharia)
    print(f"Dados de artilharia extraídos: {len(data_artilharia)} linhas.")

except Exception as e:
    print(f"Erro ao extrair dados: {str(e)}")
    df_classificacao = pd.DataFrame()
    df_jogos = pd.DataFrame(columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante", "Index"])
    df_artilharia = pd.DataFrame()

finally:
    # Fechar o navegador
    driver.quit()

# Inicializar o Firebase com o SDK
try:
    cred = credentials.Certificate('credentials.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://fpfs2025sub9-default-rtdb.firebaseio.com/'
    })
    print("Firebase inicializado com sucesso")
except Exception as e:
    print(f"Erro ao inicializar o Firebase: {e}")
    exit(1)

# Referências aos nós do Firebase
classificacao_ref = db.reference('classificacao')
jogos_ref = db.reference('jogos')
artilharia_ref = db.reference('artilharia')

# Obter timestamp atual para organizar os dados
timestamp = time.strftime('%Y%m%d_%H%M%S')

# Enviar dados de classificação para o Firebase
for index, row in df_classificacao.iterrows():
    row_key = f"{timestamp}_{index}"
    try:
        classificacao_ref.child(row_key).set(row.to_dict())
        print(f"Linha de classificação {row_key} gravada com sucesso")
    except Exception as e:
        print(f"Erro ao gravar linha de classificação {row_key}: {str(e)}")

# Enviar dados de jogos para o Firebase, mantendo a ordem do índice
for index, row in df_jogos.iterrows():
    row_key = f"{timestamp}_{int(row['Index'])}"  # Usar o índice da coluna Index
    try:
        jogos_ref.child(row_key).set(row.to_dict())
        print(f"Linha de jogos {row_key} gravada com sucesso")
    except Exception as e:
        print(f"Erro ao gravar linha de jogos {row_key}: {str(e)}")

# Enviar dados de artilharia para o Firebase
for index, row in df_artilharia.iterrows():
    row_key = f"{timestamp}_{index}"
    try:
        artilharia_ref.child(row_key).set(row.to_dict())
        print(f"Linha de artilharia {row_key} gravada com sucesso")
    except Exception as e:
        print(f"Erro ao gravar linha de artilharia {row_key}: {str(e)}")