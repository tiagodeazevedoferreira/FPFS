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
    cred_path = 'credentials.json'
    if not os.path.exists(cred_path):
        raise FileNotFoundError("credentials.json não encontrado")

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://fpfs2025sub9-default-rtdb.firebaseio.com/'
    })
    print("Firebase inicializado com sucesso")
except Exception as e:
    print(f"Erro ao inicializar Firebase: {e}")
    driver.quit()
    exit(1)

# Referências aos nós (sem prefixos)
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

    try:
        # =============================================
        # 1. CLASSIFICAÇÃO
        # =============================================
        driver.get(url_base)
        time.sleep(6)

        table = None
        try:
            table = WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '.classification_table'))
            )
            print("  → Encontrada tabela com classe .classification_table")
        except:
            try:
                table = WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
                )
                print("  → Usando fallback: primeira tabela da página")
            except:
                print("  → Nenhuma tabela de classificação encontrada")

        if table:
            rows = table.find_elements(By.TAG_NAME, 'tr')
            data = []

            for row in rows:
                cells = row.find_elements(By.TAG_NAME, 'th') or row.find_elements(By.TAG_NAME, 'td')
                row_text = [cell.text.strip() for cell in cells if cell.text.strip()]
                if row_text:
                    data.append(row_text)

            if data:
                # Identificar cabeçalho
                header = None
                data_rows = []
                max_cols = max(len(r) for r in data) if data else 0

                for row in data:
                    if len(row) >= max_cols - 2:
                        if header is None:
                            header = row
                    else:
                        if len(row) == len(header or []):
                            data_rows.append(row)

                if header is None or len(header) == 0:
                    header = [f"Col_{i+1}" for i in range(max_cols)]
                    data_rows = data

                try:
                    df = pd.DataFrame(data_rows, columns=header[:len(data_rows[0]) if data_rows else len(header)])
                    df['Index'] = range(len(df))

                    # Salvar no formato antigo: chaves numéricas diretas
                    for idx, row in df.to_dict(orient='records').items():
                        classificacao_ref.child(str(idx)).set(row)

                    print(f"  → Classificação salva ({len(df)} linhas)")
                except Exception as e:
                    print(f"  → Falha ao criar/salvar DataFrame classificação: {e}")
                    classificacao_ref.set(data)  # fallback raw
                    print("  → Dados crus salvos como fallback")
            else:
                print("  → Nenhuma linha válida na classificação")

        # =============================================
        # 2. JOGOS
        # =============================================
        driver.get(f"{url_base}/jogos")
        time.sleep(6)

        table = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.TAG_NAME, 'table'))
        )

        rows = table.find_elements(By.TAG_NAME, 'tr')
        jogos_data = []

        for row in rows:
            cols = [c.text.strip().replace("Ver Súmula", "").strip() for c in row.find_elements(By.TAG_NAME, 'td')]
            if len(cols) >= 4:
                data_col = cols[0]
                parts = data_col.split('/')
                if len(parts) == 2:
                    data_col = f"{data_col}/2026"
                jogos_data.append({
                    'Data': data_col,
                    'Horário': cols[1] if len(cols) > 1 else '',
                    'Ginásio': cols[2] if len(cols) > 2 else '',
                    'JogoCompleto': ' '.join(cols[3:]) if len(cols) > 3 else ''
                })

        if jogos_data:
            # Salvar no formato antigo: chaves numéricas diretas
            for idx, item in enumerate(jogos_data):
                jogos_ref.child(str(idx)).set(item)
            print(f"  → Jogos salvos ({len(jogos_data)} partidas)")
        else:
            print("  → Nenhuma partida encontrada")

        # =============================================
        # 3. ARTILHARIA
        # =============================================
        driver.get(f"{url_base}/artilharia")
        time.sleep(6)

        table = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.TAG_NAME, 'table'))
        )

        rows = table.find_elements(By.TAG_NAME, 'tr')
        artilharia_data = []
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, 'td')
            row_text = [cell.text.strip() for cell in cells if cell.text.strip()]
            if row_text:
                artilharia_data.append(row_text)

        if artilharia_data:
            header_art = artilharia_data[0] if artilharia_data else []
            data_art = artilharia_data[1:]
            try:
                df_art = pd.DataFrame(data_art, columns=header_art[:len(data_art[0]) if data_art else len(header_art)])
                for idx, row in df_art.to_dict(orient='records').items():
                    artilharia_ref.child(str(idx)).set(row)
                print(f"  → Artilharia salva ({len(df_art)} linhas)")
            except Exception as e:
                print(f"  → Falha ao salvar artilharia: {e}")
                artilharia_ref.set(artilharia_data)  # fallback
        else:
            print("  → Nenhuma artilharia encontrada")

    except Exception as e:
        print(f"  → Erro geral ao processar {categoria}: {str(e)}")

# =============================================
# Executar APENAS para Sub-10 2026 (evento 911)
# =============================================
encontrado = False
for key, event in links.items():
    link = event.get('Link', '')
    categoria = event.get('Categoria', '')
    ano = event.get('Ano', '')
    if '911' in link or ('Sub-10' in categoria and '2026' in ano):
        scrape_and_save(key, event)
        encontrado = True
        break

if not encontrado:
    print("Nenhum evento Sub-10 2026 encontrado no links.json")

driver.quit()
print("\nScraper finalizado.")