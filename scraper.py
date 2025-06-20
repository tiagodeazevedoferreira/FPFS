```python
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

# Configurar o Selenium para rodar sem interface (headless)
options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

# Iniciar o driver do Chrome
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

# Lista de categorias e séries com IDs de evento
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

# Listas consolidadas para todos os dados
all_data_classificacao = []
all_data_jogos = []
all_data_artilharia = []

try:
    for evento in eventos:
        sub = evento['Sub']
        serie = evento['Serie']
        event_id = evento['id']
        print(f"\nProcessando {sub} {serie} (Evento ID: {event_id})...")

        # Extrair tabela de classificação
        url_classificacao = f"https://eventos.admfutsal.com.br/evento/{event_id}"
        driver.get(url_classificacao)
        time.sleep(5)  # Espera inicial
        try:
            table_classificacao = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '.classification_table'))
            )
            rows_classificacao = table_classificacao.find_elements(By.TAG_NAME, 'tr')
            data_classificacao = []
            for row in rows_classificacao:
                cols = row.find_elements(By.TAG_NAME, 'td')
                cols = [col.text for col in cols]
                if cols:  # Ignorar linhas vazias
                    data_classificacao.append(cols)
            df_classificacao = pd.DataFrame(data_classificacao)
            if not df_classificacao.empty:
                # Adicionar colunas Sub, Serie e Index
                df_classificacao['Sub'] = sub
                df_classificacao['Serie'] = serie
                df_classificacao['Index'] = df_classificacao.index
                # Ordenar por Index
                df_classificacao = df_classificacao.sort_values(by='Index', ascending=True)
                all_data_classificacao.append(df_classificacao)
                print(f"Dados de classificação extraídos para {sub} {serie}: {len(data_classificacao)} linhas")
            else:
                print(f"Sem dados de classificação para {sub} {serie}")
        except Exception as e:
            print(f"Erro ao extrair classificação para {sub} {serie}: {str(e)}")

        # Extrair tabela de jogos
        url_jogos = f"https://eventos.admfutsal.com.br/evento/{event_id}/jogos"
        driver.get(url_jogos)
        time.sleep(5)  # Espera inicial
        try:
            table_jogos = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
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
                if len(row) < 4:  # Garantir que haja pelo menos Data, Horário, Ginásio e última coluna
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
                    # Tudo depois do placar2 é o Visitante (removendo sufixos como "- A")
                    visitante = " ".join(partes[placar_index+2:]).strip().split(" - ")[0].strip()

                formatted_jogos.append([data, horario, ginasio, mandante, placar1, "X", placar2, visitante])

            # Criar DataFrame com índice explícito
            df_jogos = pd.DataFrame(formatted_jogos, columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante"])
            if not df_jogos.empty:
                df_jogos['Sub'] = sub
                df_jogos['Serie'] = serie
                df_jogos['Index'] = df_jogos.index
                df_jogos = df_jogos.sort_values(by='Index', ascending=True)
                all_data_jogos.append(df_jogos)
                print(f"Dados de jogos formatados para {sub} {serie}: {len(formatted_jogos)} linhas")
            else:
                print(f"Sem dados de jogos para {sub} {serie}")
        except Exception as e:
            print(f"Erro ao extrair jogos para {sub} {serie}: {str(e)}")

        # Extrair tabela de artilharia
        url_artilharia = f"https://eventos.admfutsal.com.br/evento/{event_id}/artilharia"
        driver.get(url_artilharia)
        time.sleep(5)  # Espera inicial
        try:
            table_artilharia = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'table'))
            )
            rows_artilharia = table_artilharia.find_elements(By.TAG_NAME, 'tr')
            data_artilharia = []
            for row in rows_artilharia:
                cols = row.find_elements(By.TAG_NAME, 'td')
                cols = [col.text.strip() for col in cols]
                if cols:  # Ignorar linhas vazias
                    data_artilharia.append(cols)
            df_artilharia = pd.DataFrame(data_artilharia, columns=["Jogador", "Clube", "Gols"])
            if not df_artilharia.empty:
                df_artilharia['Sub'] = sub
                df_artilharia['Serie'] = serie
                df_artilharia['Index'] = df_artilharia.index
                all_data_artilharia.append(df_artilharia)
                print(f"Dados de artilharia extraídos para {sub} {serie}: {len(data_artilharia)} linhas")
            else:
                print(f"Sem dados de artilharia para {sub} {serie}")
        except Exception as e:
            print(f"Erro ao extrair artilharia para {sub} {serie}: {str(e)}")

finally:
    # Fechar o navegador
    driver.quit()

# Consolidar os DataFrames
df_classificacao_final = pd.concat(all_data_classificacao, ignore_index=True) if all_data_classificacao else pd.DataFrame()
df_jogos_final = pd.concat(all_data_jogos, ignore_index=True) if all_data_jogos else pd.DataFrame(columns=["Data", "Horário", "Ginásio", "Mandante", "Placar 1", "X", "Placar 2", "Visitante", "Sub", "Serie", "Index"])
df_artilharia_final = pd.concat(all_data_artilharia, ignore_index=True) if all_data_artilharia else pd.DataFrame(columns=["Jogador", "Clube", "Gols", "Sub", "Serie", "Index"])

# Verificar se os DataFrames estão vazios
if df_classificacao_final.empty and df_jogos_final.empty and df_artilharia_final.empty:
    print("Erro: Nenhum dado foi extraído.")
    exit(1)

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
timestamp = time.strftime('%Y%m%d_%H%M%S_')

# Enviar dados de classificação para o Firebase
for index, row in df_classificacao_final.iterrows():
    row_key = f"{row['Sub']}_{row['Serie']}_{timestamp}{int(row['Index'])}"
    try:
        print(f"Tentando gravar linha de classificação {row_key}: {row.to_dict()}")
        classificacao_ref.child(row_key).set(row.to_dict())
        print(f"Linha de classificação {row_key} gravada com sucesso")
    except Exception as e:
        print(f"Erro ao gravar linha de classificação {row_key}: {str(e)}")

# Enviar dados de jogos para o Firebase
for index, row in df_jogos_final.iterrows():
    row_key = f"{row['Sub']}_{row['Serie']}_{timestamp}{int(row['Index'])}"
    try:
        print(f"Tentando gravar linha de jogos {row_key}: {row.to_dict()}")
        jogos_ref.child(row_key).set(row.to_dict())
        print(f"Linha de jogos {row_key} gravada com sucesso")
    except Exception as e:
        print(f"Erro ao gravar linha de jogos {row_key}: {str(e)}")

# Enviar dados de artilharia para o Firebase
for index, row in df_artilharia_final.iterrows():
    row_key = f"{row['Sub']}_{row['Serie']}_{timestamp}{int(row['Index'])}"
    try:
        print(f"Tentando gravar linha de artilharia {row_key}: {row.to_dict()}")
        artilharia_ref.child(row_key).set(row.to_dict())
        print(f"Linha de artilharia {row_key} gravada com sucesso")
    except Exception as e:
        print(f"Erro ao gravar linha de artilharia {row_key}: {str(e)}")
```