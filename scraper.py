from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import time
import firebase_admin
from firebase_admin import credentials, db
from concurrent.futures import ThreadPoolExecutor
import logging
import os

# Configurar cache do webdriver_manager
os.environ['WDM_LOCAL'] = '1'
os.environ['WDM_CACHE_PATH'] = os.path.expanduser('~/.wdm')

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configurar o Selenium para rodar sem interface (headless)
def create_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    for attempt in range(3):
        try:
            return webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=options
            )
        except Exception as e:
            logging.error(f"Tentativa {attempt+1} falhou: {str(e)}")
            time.sleep(2)
    logging.error("Falha ao criar driver após 3 tentativas")
    raise Exception("Não foi possível inicializar o ChromeDriver")

# Lista de categorias e séries com IDs de evento (substituir pelos IDs reais)
eventos = [
    {'Sub': 'Sub-7', 'Serie': 'A1', 'id': '860'},
    {'Sub': 'Sub-7', 'Serie': 'A2', 'id': '861'},
    {'Sub': 'Sub-8', 'Serie': 'A1', 'id': '862'},
    {'Sub': 'Sub-8', 'Serie': 'A2', 'id': '863'},
    {'Sub': 'Sub-9', 'Serie': 'A1', 'id': '870'},
    {'Sub': 'Sub-9', 'Serie': 'A2', 'id': '871'},
    {'Sub': 'Sub-10', 'Serie': 'A1', 'id': '872'},
    {'Sub': 'Sub-10', 'Serie': 'A2', 'id': '873'}
]

# Função para extrair tabela com retries
def extract_table(driver, url, selector, sub, serie, table_type):
    logging.info(f"Extraindo {table_type} para {sub} {serie} de {url}")
    driver.get(url)
    try:
        # Tentar múltiplos seletores
        for sel in [selector, 'table', '.table', f'.{table_type.lower()}_table']:
            try:
                table = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, sel))
                )
                rows = table.find_elements(By.TAG_NAME, 'tr')
                data = []
                for row in rows:
                    cols = row.find_elements(By.TAG_NAME, 'td')
                    cols = [col.text.strip() for col in cols if col.text.strip()]
                    if cols:
                        data.append(cols)
                logging.info(f"Extraídos {len(data)} linhas de {table_type} para {sub} {serie}")
                return data
            except Exception as e:
                logging.debug(f"Seletor {sel} falhou para {table_type}: {str(e)}")
        logging.warning(f"Nenhuma tabela encontrada para {table_type} em {sub} {serie}")
        return []
    except Exception as e:
        logging.error(f"Erro ao extrair {table_type} para {sub} {serie}: {str(e)}")
        return []

# Função para processar um evento
def process_event(evento):
    sub = evento['Sub']
    serie = evento['Serie']
    event_id = evento['id']
    driver = create_driver()
    try:
        # Extrair classificação
        url_classificacao = f"https://eventos.admfutsal.com.br/evento/{event_id}"
        data_classificacao = extract_table(driver, url_classificacao, '.classification_table', sub, serie, 'classificacao')
        df_classificacao = pd.DataFrame(data_classificacao)
        if not df_classificacao.empty:
            df_classificacao['Sub'] = sub
            df_classificacao['Serie'] = serie
            df_classificacao['Index'] = df_classificacao.index
            df_classificacao = df_classificacao.sort_values(by='Index', ascending=True)
        else:
            df_classificacao = pd.DataFrame()

        # Extrair jogos
        url_jogos = f"https://eventos.admfutsal.com.br/evento/{event_id}/jogos"
        data_jogos = extract_table(driver, url_jogos, 'table', sub, serie, 'jogos')
        formatted_jogos = []
        for row in data_jogos:
            if len(row) < 4:
                continue
            data = row[0] if len(row) > 0 else ""
            if data and len(data.split('/')) == 2:
                data = f"{data}/2025"
            horario = row[1] if len(row) > 1 else ""
            ginasio = row[2] if len(row) > 2 else ""
            ultima_coluna = row[-1] if row else ""
            mandante = ""
            placar1 = ""
            placar2 = ""
            visitante = ""
            partes = ultima_coluna.split()
            placar_index = -1
            for i, parte in enumerate(partes):
                if parte.lower() == "x" and i > 0 and i < len(partes)-1 and partes[i-1].isdigit() and partes[i+1].isdigit():
                    placar_index = i
                    placar1 = partes[i-1]
                    placar2 = partes[i+1]
                    break
            if placar_index != -1:
                mandante = " ".join(partes[:placar_index-1]).strip()
                visitante = " ".join(partes[placar_index+2:]).strip().split(" - ")[0].strip()
            formatted_jogos.append([data, horario, ginasio, mandante, placar1, "X", placar2, visitante])
        df_jogos = pd.DataFrame(formatted_jogos, columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante"])
        if not df_jogos.empty:
            df_jogos['Sub'] = sub
            df_jogos['Serie'] = serie
            df_jogos['Index'] = df_jogos.index
            df_jogos = df_jogos.sort_values(by='Index', ascending=True)
        else:
            df_jogos = pd.DataFrame(columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante", "Sub", "Serie", "Index"])

        # Extrair artilharia
        url_artilharia = f"https://eventos.admfutsal.com.br/evento/{event_id}/artilharia"
        data_artilharia = extract_table(driver, url_artilharia, 'table', sub, serie, 'artilharia')
        df_artilharia = pd.DataFrame(data_artilharia)
        if not df_artilharia.empty:
            if len(df_artilharia.columns) >= 3:
                df_artilharia = df_artilharia.iloc[:, :3].copy()
                df_artilharia.columns = ["Jogador", "Clube", "Gols"]
            else:
                df_artilharia.columns = [f"Col_{i}" for i in range(len(df_artilharia.columns))]
            df_artilharia['Sub'] = sub
            df_artilharia['Serie'] = serie
            df_artilharia['Index'] = df_artilharia.index
            df_artilharia = df_artilharia.sort_values(by='Index', ascending=True)
        else:
            df_artilharia = pd.DataFrame(columns=["Jogador", "Clube", "Gols", "Sub", "Serie", "Index"])

        return df_classificacao, df_jogos, df_artilharia
    finally:
        driver.quit()

# Inicializar o Firebase
try:
    cred = credentials.Certificate('credentials.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://fpfs2025sub9-default-rtdb.firebaseio.com/'
    })
    logging.info("Firebase inicializado com sucesso")
except Exception as e:
    logging.error(f"Erro ao inicializar o Firebase: {e}")
    exit(1)

# Processar eventos em paralelo
all_data_classificacao = []
all_data_jogos = []
all_data_artilharia = []
with ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(process_event, eventos))
    for df_class, df_jogos, df_art in results:
        if not df_class.empty:
            all_data_classificacao.append(df_class)
        if not df_jogos.empty:
            all_data_jogos.append(df_jogos)
        if not df_art.empty:
            all_data_artilharia.append(df_art)

# Consolidar os DataFrames
df_classificacao_final = pd.concat(all_data_classificacao, ignore_index=True) if all_data_classificacao else pd.DataFrame()
df_jogos_final = pd.concat(all_data_jogos, ignore_index=True) if all_data_jogos else pd.DataFrame(columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante", "Sub", "Serie", "Index"])
df_artilharia_final = pd.concat(all_data_artilharia, ignore_index=True) if all_data_artilharia else pd.DataFrame(columns=["Jogador", "Clube", "Gols", "Sub", "Serie", "Index"])

# Verificar se os DataFrames estão vazios
if df_classificacao_final.empty and df_jogos_final.empty and df_artilharia_final.empty:
    logging.error("Erro: Nenhum dado foi extraído.")
    exit(1)

# Referências aos nós do Firebase
classificacao_ref = db.reference('classificacao')
jogos_ref = db.reference('jogos')
artilharia_ref = db.reference('artilharia')

# Obter ano atual
year = time.strftime('%Y')

# Enviar dados em lotes
def send_batch(ref, df, table_type):
    if df.empty:
        logging.warning(f"Nenhum dado para enviar em {table_type}")
        return
    batch = {}
    for index, row in df.iterrows():
        row_key = f"{year}_{int(row['Index'])}"
        batch[row_key] = row.to_dict()
    try:
        ref.update(batch)
        logging.info(f"{len(batch)} linhas de {table_type} gravadas com sucesso")
    except Exception as e:
        logging.error(f"Erro ao gravar batch de {table_type}: {str(e)}")

send_batch(classificacao_ref, df_classificacao_final, 'classificacao')
send_batch(jogos_ref, df_jogos_final, 'jogos')
send_batch(artilharia_ref, df_artilharia_final, 'artilharia')
