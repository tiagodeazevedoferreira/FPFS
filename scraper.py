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
import json
import os

# Configurações do Selenium (headless para rodar no GitHub Actions)
options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
options.add_argument('--disable-gpu')
options.add_argument('--window-size=1920,1080')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# =============================================
# Carregar configuração do links.json
# =============================================
try:
    with open('links.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    links = config.get('links', {})
    print(f"Carregados {len(links)} eventos do links.json")
except Exception as e:
    print(f"Erro ao ler links.json: {e}")
    driver.quit()
    exit(1)

# =============================================
# Inicializar Firebase (uma única vez)
# =============================================
try:
    # No GitHub Actions, a variável de ambiente GOOGLE_CREDENTIALS já deve existir
    # Aqui usamos o arquivo só se estiver rodando localmente
    cred_path = 'credentials.json'
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    else:
        # No Actions, o secret já foi escrito no passo anterior
        cred = credentials.Certificate('credentials.json')  # criado pelo workflow

    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://fpfs2025sub9-default-rtdb.firebaseio.com/'
    })
    print("Firebase inicializado com sucesso")
except Exception as e:
    print(f"Erro ao inicializar Firebase: {e}")
    driver.quit()
    exit(1)

# Referências aos nós
classificacao_ref = db.reference('classificacao')
jogos_ref = db.reference('jogos')
artilharia_ref = db.reference('artilharia')

# =============================================
# Função principal de scraping por evento
# =============================================
def scrape_and_save(event_key, event_data):
    url_base = event_data['Link']
    categoria = event_data['Categoria']
    divisao   = event_data['Divisao']
    ano       = event_data['Ano']
    
    print(f"\nProcessando: {categoria} {divisao} {ano} ({url_base.split('/')[-1]})")

    prefix = f"{ano}_{categoria.replace(' ','').replace('-','')}_{divisao}"

    try:
        # 1. Classificação
        driver.get(url_base)
        time.sleep(4)
        
        table = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '.classification_table, table'))
        )
        
        rows = table.find_elements(By.TAG_NAME, 'tr')
        data = [[col.text.strip() for col in row.find_elements(By.TAG_NAME, 'td')] for row in rows if row.text.strip()]
        
        if data:
            df = pd.DataFrame(data[1:], columns=data[0] if data else None)
            df['Index'] = range(len(df))
            classificacao_ref.child(f"{prefix}").set(df.to_dict(orient='records'))
            print(f"  → Classificação salva ({len(df)} linhas)")
        else:
            print("  → Nenhuma linha encontrada na classificação")

        # 2. Jogos
        driver.get(f"{url_base}/jogos")
        time.sleep(4)
        
        table = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
        )
        
        rows = table.find_elements(By.TAG_NAME, 'tr')
        jogos_data = []
        
        for row in rows:
            cols = [c.text.strip().replace("Ver Súmula", "").strip() for c in row.find_elements(By.TAG_NAME, 'td')]
            if len(cols) >= 4:
                data_col = cols[0]
                if '/' in data_col and len(data_col.split('/')) == 2:
                    data_col += '/2026'  # ajuste para 2026
                jogos_data.append({
                    'Data': data_col,
                    'Horário': cols[1] if len(cols) > 1 else '',
                    'Ginásio': cols[2] if len(cols) > 2 else '',
                    'JogoCompleto': cols[-1] if cols else ''
                })
        
        if jogos_data:
            jogos_ref.child(f"{prefix}").set(jogos_data)
            print(f"  → Jogos salvos ({len(jogos_data)} partidas)")
        else:
            print("  → Nenhuma partida encontrada")

        # 3. Artilharia
        driver.get(f"{url_base}/artilharia")
        time.sleep(4)
        
        table = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
        )
        
        rows = table.find_elements(By.TAG_NAME, 'tr')
        artilharia_data = [[col.text.strip() for col in row.find_elements(By.TAG_NAME, 'td')] for row in rows if row.text.strip()]
        
        if artilharia_data:
            df_art = pd.DataFrame(artilharia_data[1:], columns=artilharia_data[0] if artilharia_data else None)
            artilharia_ref.child(f"{prefix}").set(df_art.to_dict(orient='records'))
            print(f"  → Artilharia salva ({len(df_art)} linhas)")
        else:
            print("  → Nenhuma artilharia encontrada")

    except Exception as e:
        print(f"  → Erro ao processar {categoria}: {str(e)}")

# =============================================
# Executar apenas para Sub-10 2026
# =============================================
for key, event in links.items():
    if 'Sub-10' in event.get('Categoria', '') and '2026' in event.get('Ano', ''):
        scrape_and_save(key, event)
        break  # só o primeiro que bater (como só tem um)
    elif '911' in event.get('Link', ''):
        scrape_and_save(key, event)
        break

driver.quit()
print("\nScraper finalizado.")