console.log('script.js iniciado');

// URL base do Firebase Realtime Database
const FIREBASE_URL = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/';

let allDataSheet1 = []; // Dados do nó jogos (Placar)
let allDataClassification = []; // Dados do nó classificacao
let filteredDataPlacar = []; // Placar
let sortConfigPlacar = { column: 18, direction: 'asc' }; // Default to Index column
let allDataArtilharia = []; // Dados do nó artilharia

// Função para normalizar strings (remove espaços, caracteres especiais e converte para minúsculas)
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD') // Normaliza caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, ''); // Remove caracteres especiais
}

// Função para converter texto para title case
function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/(^|\s)\w/g, char => char.toUpperCase());
}

async function fetchFirebaseData(node) {
  const url = `${FIREBASE_URL}${node}.json`;
  console.log(`Iniciando requisição ao Firebase para ${node}:`, url);
  try {
    const response = await fetch(url, { mode: 'cors' });
    console.log(`Resposta recebida para ${node}:`, response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro HTTP para ${node}:`, errorText);
      throw new Error(
        response.status === 403 ? 'Acesso negado (403). Verifique as regras do Firebase.' :
        response.status === 404 ? `Nó ${node} não encontrado (404). Verifique o caminho no Firebase.` :
        response.status === 429 ? 'Limite de requisições excedido (429). Tente novamente mais tarde.' :
        `Erro HTTP: ${response.status} - ${errorText}`
      );
    }
    const data = await response.json();
    console.log(`Dados brutos recebidos para ${node}:`, JSON.stringify(data, null, 2));
    if (!data || Object.keys(data).length === 0) {
      console.warn(`Nenhum dado retornado para ${node}. O nó pode estar vazio.`);
      throw new Error(`Nenhum dado retornado. O nó ${node} está vazio ou não existe.`);
    }

    let dataArray = [];
    if (node === 'jogos') {
      const headers = [
        'Campeonato', 'Data', 'Horário', 'Ginásio', 'Mandante', 'Placar 1', 'Placar 2', 'Visitante',
        'Local', 'Rodada', 'Dia da Semana', 'Gol', 'Assistências', 'Vitória', 'Derrota', 'Empate', 'Considerar', 'Index'
      ];
      dataArray.push(headers);
      Object.entries(data).forEach(([key, row]) => {
        const index = parseInt(key.split('_').pop()) || 0;
        const rowArray = [
          'FPFS Sub-9 2025',
          row['Data'] || '',
          row['Horário'] || '',
          row['Ginásio'] || '',
          row['Mandante'] || '',
          row['Placar 1'] || '',
          row['Placar 2'] || '',
          row['Visitante'] || '',
          '', '', '', '', '',
          row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) > parseInt(row['Placar 2']) ? '1' : '0') : '',
          row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) < parseInt(row['Placar 2']) ? '1' : '0') : '',
          row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) === parseInt(row['Placar 2']) ? '1' : '0') : '',
          row['Considerar'] || '1',
          index
        ];
        dataArray.push(rowArray);
      });
    } else if (node === 'classificacao') {
      const headers = ['Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Pró', 'Gols Contra', 'Saldo', 'Aproveitamento'];
      dataArray.push(headers);
      Object.entries(data).forEach(([key, row]) => {
        if (key === '0') return; // Ignora a chave 0
        const rowArray = [
          row['1'] || '', row['2'] || '', row['3'] || '', row['4'] || '', row['5'] || '',
          row['6'] || '', row['7'] || '', row['8'] || '', row['9'] || '', row['10'] || '',
          row['11'] || ''
        ];
        dataArray.push(rowArray);
      });
    } else if (node === 'artilharia') {
      const headers = ['#', 'Jogador', 'Clube', 'Gols'];
      dataArray.push(headers);
      Object.entries(data).forEach(([key, row]) => {
        const index = parseInt(key.split('_').pop()) || 0;
        const rowArray = [
          index,
          toTitleCase(row['1'] || ''),
          toTitleCase(row['2'] || ''),
          row['3'] || ''
        ];
        console.log(`Linha processada para artilharia (chave ${key}):`, rowArray);
        dataArray.push(rowArray);
      });
    }
    console.log(`Dados convertidos para ${node}:`, dataArray);
    return dataArray;
  } catch (error) {
    console.error(`Erro ao buscar dados do ${node}:`, error.message);
    showError(`Erro ao carregar dados do ${node}: ${error.message}`);
    return [];
  }
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (!errorDiv) {
    console.error('Elemento #errorMessage não encontrado');
    return;
  }
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  console.log('Erro exibido:', message);
}

function clearError() {
  const errorDiv = document.getElementById('errorMessage');
  if (!errorDiv) {
    console.error('Elemento #errorMessage não encontrado');
    return;
  }
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
  console.log('Erro limpo');
}

function formatTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const [hours, minutes] = timeStr.split(':').map(num => parseInt(num.trim()) || 0);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function populateFiltersSheet1(data) {
  console.log('Populando filtros de Placar com', data);
  const filters = [
    { id: 'campeonato', index: 0 }
  ];

  const tabs = ['placar'];

  tabs.forEach(tab => {
    filters.forEach(filter => {
      const select = document.getElementById(`${filter.id}-${tab}`);
      if (select) {
        select.innerHTML = '<option value="">Todos</option>';
        const values = [...new Set(data.slice(1).map(row => row[filter.index]?.trim()))].filter(v => v).sort();
        values.forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });
      } else {
        console.error(`Elemento #${filter.id}-${tab} não encontrado no DOM`);
      }
    });
  });
}
function sortData(data, columnIndex, direction) {
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    let actualIndex = columnIndex;
    if (actualIndex >= 5) {
      actualIndex = actualIndex === 5 ? 5 : actualIndex === 6 ? 6 : actualIndex === 18 ? 18 : actualIndex;
    }

    let valueA = a[actualIndex] || '';
    let valueB = b[actualIndex] || '';

    if (actualIndex === 18) {
      valueA = parseInt(valueA) || 0;
      valueB = parseInt(valueB) || 0;
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    if (actualIndex === 1) {
      valueA = valueA ? new Date(valueA.split('/').reverse().join('-')) : new Date(0);
      valueB = valueB ? new Date(valueB.split('/').reverse().join('-')) : new Date(0);
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    if ([5, 6].includes(actualIndex)) {
      valueA = parseInt(valueA) || 0;
      valueB = parseInt(valueB) || 0;
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    valueA = valueA.toString().toLowerCase();
    valueB = valueB.toString().toLowerCase();
    return direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
  });
  return sortedData;
}

function sortArtilhariaData(data) {
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    const indexA = parseInt(a[0]) || 0;
    const indexB = parseInt(b[0]) || 0;
    console.log(`Comparando: ${a[1]} (Índice ${indexA}) vs ${b[1]} (Índice ${indexB})`);
    return indexA - indexB;
  });
  return sortedData.slice(1);
}

function displayData(data, filteredData, page) {
  console.log(`Exibindo dados para ${page}`, filteredData);
  clearError();

  const tbody = document.querySelector(`#${page}Body`);
  const thead = document.querySelector(`#tableHead-${page}`);
  if (!tbody || !thead) {
    console.error(`Elementos #${page}Body ou #tableHead-${page} não encontrados`);
    showError('Erro interno: tabela não encontrada.');
    return;
  }

  tbody.innerHTML = '';
  thead.innerHTML = '';

  const trHead = document.createElement('tr');
  trHead.className = 'bg-gray-200';

  const headers = ['Data', 'Horário', 'Ginásio', 'Mandante', 'Placar1', 'Placar2', 'Visitante'];
  const columnIndices = [1, 2, 3, 4, 5, 6, 7];
  const sortConfig = sortConfigPlacar;

  headers.forEach((text, idx) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.className = 'p-2 sortable';
    th.dataset.index = columnIndices[idx];

    if (sortConfig.column === columnIndices[idx]) {
      th.classList.add(sortConfig.direction === 'asc' ? 'asc-' : 'desc-asc');
    }

    th.addEventListener('click', () => {
      const newDirection = sortConfig.column === columnIndices[idx] && sortConfig.direction === 'asc' ? 'desc' : 'asc';
      sortConfigPlacar.column = columnIndices[idx];
      sortConfigPlacar.direction = newDirection;
      const sortedData = sortData(filteredData, columnIndices[idx], newDirection);
      displayData(data, sortedData, page);
      console.log(`Ordenando por coluna ${text} (${columnIndices[idx]}) em ${newDirection} para ${page}`);
    });
    trHead.appendChild(th);
  });

  thead.appendChild(trHead);

  console.log(`Total de linhas filtradas para ${page}:`, filteredData.length);

  if (filteredData.length === 0) {
    showError('Nenhum jogo encontrado com os filtros aplicados ou dados não carregados.');
  }

  filteredData.forEach((row) => {
    const tr = document.createElement('tr');
    columnIndices.forEach(idx => {
      const td = document.createElement('td');
      const cell = row[idx];
      td.textContent = idx === 2 ? formatTime(cell) : cell || '';
      td.className = 'p-2 border';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function displayClassification() {
  console.log('Exibindo dados da Classificação:', allDataClassification);
  clearError();
  const tbody = document.getElementById('classificationBody');
  const thead = document.getElementById('tableHead-classification');
  if (!tbody || !thead) {
    console.error('Elementos #classificationBody ou #tableHead-classification não encontrados');
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const trHead = document.createElement('tr');
  trHead.className = 'bg-gray-200';
  const headers = allDataClassification[0] || ['Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Pró', 'Gols Contra', 'Saldo', 'Aproveitamento'];
  headers.forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.className = 'p-2';
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const filteredData = allDataClassification.slice(1);
  console.log('Dados a exibir na Classificação:', filteredData);
  if (filteredData.length === 0) {
    showError('Nenhum dado de classificação encontrado no nó classificacao.');
  }

  filteredData.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell || '';
      td.className = 'p-2 border';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function filterDataSheet1(data, filters) {
  console.log('Aplicando filtros para placar:', filters);

  let filteredRows = data.slice(1).filter((row, index) => {
    if (!row || row.length < 18) {
      console.log(`Linha ${index + 2} inválida:`, row);
      return false;
    }

    const [
      campeonato, dataStr, horario, ginasio, mandante, placar1, placar2, visitante,
      local, rodada, diaSemana, gol, assistencias, vitoria, derrota, empate, considerar, Index
    ] = row;

    // Temporariamente remover a verificação de considerar para teste
    // const considerarValue = considerar !== undefined && considerar !== null ? String(considerar).trim() : '1';
    // const isValidConsiderar = considerarValue === '1';
    // console.log(`Linha ${index + 2}: Placar1=${placar1 || 'vazio'}, Considerar=${considerarValue}, isValidConsiderar=${isValidConsiderar}`);

    let dataJogo = null;
    try {
      if (dataStr) {
        const [day, month, year] = dataStr.split('/');
        if (day && month && year && year.length === 4) {
          dataJogo = new Date(`${year}-${month}-${day}`);
          if (isNaN(dataJogo.getTime())) {
            console.log(`Data inválida na linha ${index + 2}:`, dataStr);
            return false;
          }
        } else {
          console.log(`Formato de data inválido na linha ${index + 2}:`, dataStr);
          return false;
        }
      }
    } catch (error) {
      console.log(`Erro ao parsear data na linha ${index + 2}:`, dataStr, error);
      return false;
    }

    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;

    const normalizedMandante = normalizeString(mandante);
    const normalizedVisitante = normalizeString(visitante);
    const normalizedFilterTime = normalizeString(filters.time);

    const result = (
      // isValidConsiderar &&
      (!filters.campeonato || campeonato === filters.campeonato) &&
      (!dataInicio || (dataJogo && dataJogo >= dataInicio)) &&
      (!dataFim || (dataJogo && dataJogo <= dataFim)) &&
      (!normalizedFilterTime || normalizedMandante === normalizedFilterTime || normalizedVisitante === normalizedFilterTime)
    );

    console.log(`Linha ${index + 2}: Mandante=${mandante} (Normalizado: ${normalizedMandante}), Visitante=${visitante} (Normalizado: ${normalizedVisitante}), Filtro Time=${filters.time} (Normalizado: ${normalizedFilterTime}), Passou=${result}`);
    return result;
  }).sort((a, b) => {
    const indexA = parseInt(a[17]) || 0;
    const indexB = parseInt(b[17]) || 0;
    return indexA - indexB;
  });

  console.log('Dados filtrados e ordenados por Index:', filteredRows);
  return filteredRows;
}

function displayPlacar() {
  const filters = {
    dataInicio: document.getElementById('dataInicio-placar')?.value || '',
    dataFim: document.getElementById('dataFim-placar')?.value || '',
    campeonato: document.getElementById('campeonato-placar')?.value || ''
  };
  console.log('Filtros coletados:', filters);

  filteredDataPlacar = filterDataSheet1(allDataSheet1, filters);
  console.log('Dados filtrados para Placar:', filteredDataPlacar);

  if (sortConfigPlacar.column === null || sortConfigPlacar.column === 18) {
    sortConfigPlacar.column = 18;
    sortConfigPlacar.direction = 'asc';
  }
  const sortedData = sortData(filteredDataPlacar, sortConfigPlacar.column, sortConfigPlacar.direction);
  displayData(allDataSheet1, sortedData, 'placar');
}
function displayArtilharia() {
  console.log('Exibindo dados da Artilharia:', allDataArtilharia);
  clearError();
  const tbody = document.getElementById('artilhariaBody');
  const thead = document.getElementById('tableHead-artilharia');
  if (!tbody || !thead) {
    console.error('Elementos #artilhariaBody ou #tableHead-artilharia não encontrados');
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const trHead = document.createElement('tr');
  trHead.className = 'bg-gray-200';
  const headers = allDataArtilharia[0] || ['#', 'Jogador', 'Clube', 'Gols'];
  headers.forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.className = 'p-2';
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const filteredData = sortArtilhariaData(allDataArtilharia);
  console.log('Dados a exibir na Artilharia:', filteredData);
  if (filteredData.length === 0) {
    showError('Nenhum dado de artilharia encontrado no nó artilharia.');
  }

  filteredData.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell || '';
      td.className = 'p-2 border';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function clearFilters(tabId) {
  if (tabId === 'placar') {
    const elements = ['campeonato-placar', 'dataInicio-placar', 'dataFim-placar'];
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    displayPlacar();
  }
}
function showTab(tabId) {
  console.log(`Trocando para aba ${tabId}`);
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(btn => btn.classList.remove('active-tab'));

  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add('active');
  const activeButton = document.getElementById(`${tabId}-btn`);
  if (activeButton) activeButton.classList.add('active-tab');

  if (tabId === 'classification') displayClassification();
  else if (tabId === 'placar') displayPlacar();
  else if (tabId === 'artilharia') displayArtilharia();
}

async function init() {
  console.log('Inicializando aplicação');
  try {
    allDataSheet1 = await fetchFirebaseData('jogos');
    console.log('Dados carregados em allDataSheet1:', allDataSheet1);
    allDataClassification = await fetchFirebaseData('classificacao');
    console.log('Dados carregados em allDataClassification:', allDataClassification);
    allDataArtilharia = await fetchFirebaseData('artilharia');
    console.log('Dados carregados em allDataArtilharia:', allDataArtilharia);

    if (allDataSheet1.length <= 1) {
      console.error('Nenhum dado retornado do nó jogos');
      showError('Nenhum dado disponível no nó jogos. Verifique o Firebase.');
      return;
    }
    if (allDataClassification.length <= 1) {
      console.error('Nenhum dado retornado do nó classificacao');
      showError('Nenhum dado disponível no nó classificacao. Verifique o Firebase.');
      return;
    }
    if (allDataArtilharia.length <= 1) {
      console.error('Nenhum dado retornado do nó artilharia');
      showError('Nenhum dado disponível no nó artilharia.');
      return;
    }

    populateFiltersSheet1(allDataSheet1);
    console.log('Filtros populados');

    const classificationBtn = document.getElementById('classification-btn');
    const placarBtn = document.getElementById('placar-btn');
    const artilhariaBtn = document.getElementById('artilharia-btn');
    const aplicarFiltrosBtn = document.getElementById('aplicarFiltros-placar');
    const limparFiltrosBtn = document.getElementById('limparFiltros-placar');

    if (!classificationBtn || !placarBtn || !artilhariaBtn || !aplicarFiltrosBtn || !limparFiltrosBtn) {
      console.error('Botões não encontrados:', { classificationBtn, placarBtn, artilhariaBtn, aplicarFiltrosBtn, limparFiltrosBtn });
      showError('Erro interno: botões de navegação não encontrados.');
      return;
    }

    classificationBtn.addEventListener('click', () => {
      console.log('Clique no botão da Classificação');
      showTab('classification');
    });
    placarBtn.addEventListener('click', () => {
      console.log('Clique no botão do Placar');
      showTab('placar');
    });
    artilhariaBtn.addEventListener('click', () => {
      console.log('Clique no botão da Artilharia');
      showTab('artilharia');
    });
    aplicarFiltrosBtn.addEventListener('click', () => {
      console.log('Botão Aplicar Filtros clicado');
      displayPlacar();
    });
    limparFiltrosBtn.addEventListener('click', () => {
      console.log('Limpando filtros (Placar)');
      clearFilters('placar');
    });

    showTab('placar');
  } catch (error) {
    console.error('Erro na inicialização:', error.message);
    showError(`Erro na inicialização: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM completamente carregado');
  init();
});