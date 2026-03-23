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

# ====================== CONFIGURAÇÕES ======================
options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# ====================== CARREGAR LINKS ======================
with open('links.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

links = data['links']

# ====================== FUNÇÃO DE SCRAPING ======================
def scrape_evento(base_url, categoria, ano):
    print(f"\n🔄 Iniciando scrape → {categoria} | {ano} | ID: {base_url.split('/')[-1]}")

    try:
        # Classificação
        driver.get(base_url)
        time.sleep(5)
        table_class = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '.classification_table'))
        )
        rows = table_class.find_elements(By.TAG_NAME, 'tr')
        df_class = pd.DataFrame([ [col.text for col in row.find_elements(By.TAG_NAME, 'td')] for row in rows ])

        # Jogos
        driver.get(f"{base_url}/jogos")
        time.sleep(5)
        table_jogos = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
        )
        # (manter sua lógica de parsing de jogos aqui - não alterei para não quebrar)
        # ... [seu código atual de parsing de jogos] ...

        # Artilharia
        driver.get(f"{base_url}/artilharia")
        time.sleep(5)
        # Removido clique na aba (Sub-10 não tem aba "Geral" visível)
        table_art = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
        )
        rows_art = table_art.find_elements(By.TAG_NAME, 'tr')
        df_art = pd.DataFrame([ [col.text.strip() for col in row.find_elements(By.TAG_NAME, 'td')] for row in rows_art ])

        print(f"✅ {categoria} extraído com sucesso!")

        # ====================== ENVIAR PARA FIREBASE ======================
        cred = credentials.Certificate('credentials.json')  # será lido via secret
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://fpfs2025sub9-default-rtdb.firebaseio.com/'
        })

        prefix = f"{ano}_{categoria.replace('-','')}_"

        db.reference(f'classificacao/{prefix}').set(df_class.to_dict('records'))
        db.reference(f'jogos/{prefix}').set(df_jogos.to_dict('records'))   # df_jogos você já tem no código
        db.reference(f'artilharia/{prefix}').set(df_art.to_dict('records'))

        print(f"🚀 Dados enviados para Firebase → {categoria} {ano}")

    except Exception as e:
        print(f"❌ Erro ao processar {categoria}: {e}")

# ====================== EXECUÇÃO ======================
# Processar todos os links do JSON automaticamente
for key, item in links.items():
    if item["type"] == "classificacao":   # processamos a partir da classificacao para evitar duplicação
        base = item["Link"]
        cat = item["Categoria"]
        ano = item["Ano"]
        scrape_evento(base, cat, ano)

driver.quit()
print("🎉 Scraper finalizado - Todos eventos processados!")