console.log('script.js iniciado');

// URL base do Firebase Realtime Database
const FIREBASE_URL = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/';

let allDataSheet1 = []; // Dados do nó jogos (Placar)
let allDataClassification = []; // Dados do nó classificacao
let filteredDataPlacar = []; // Placar
let filteredDataClassification = []; // Classificação
let sortConfigPlacar = { column: 18, direction: 'asc' }; // Default to Index column
let allDataArtilharia = []; // Dados do nó artilharia

// Função para normalizar strings
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '');
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
      const seenRows = new Set(); // Para rastrear linhas únicas
      Object.entries(data).forEach(([key, row]) => {
        const index = parseInt(key.split('_').pop()) || 0;
        const rowArray = [
          'FPFS Sub-9 2025',
          row['Data'] || '',
          row['Horário'] || '',
          toTitleCase(row['Ginásio'] || ''),
          toTitleCase(row['Mandante'] || ''),
          row['Placar 1'] || '',
          row['Placar 2'] || '',
          toTitleCase(row['Visitante'] || ''),
          '', '', '', '', '',
          row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) > parseInt(row['Placar 2']) ? '1' : '0') : '',
          row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) < parseInt(row['Placar 2']) ? '1' : '0') : '',
          row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) === parseInt(row['Placar 2']) ? '1' : '0') : '',
          row['Considerar'] || '1',
          index
        ];
        const rowKey = `${rowArray[1]}-${rowArray[4]}-${rowArray[7]}-${rowArray[5]}-${rowArray[6]}-${index}`;
        if (!seenRows.has(rowKey)) {
          seenRows.add(rowKey);
          dataArray.push(rowArray);
        } else {
          console.warn(`Linha duplicada detectada e ignorada: ${rowKey}`);
        }
      });
      console.log(`Dados únicos processados para jogos:`, dataArray);
    } else if (node === 'classificacao') {
      const headers = ['Index', 'Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Pró', 'Gols Contra', 'Saldo', 'Aproveitamento'];
      dataArray.push(headers);
      Object.entries(data).forEach(([key, row]) => {
        if (key === '0') return; // Ignora a chave 0
        const index = parseInt(key.split('_').pop()) || 0;
        const rowArray = [
          index,
          row['1'] || '',
          toTitleCase(row['2'] || ''),
          row['3'] || '',
          row['4'] || '',
          row['5'] || '',
          row['6'] || '',
          row['7'] || '',
          row['8'] || '',
          row['9'] || '',
          row['10'] || '',
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
3713
    showError(`Erro ao carregar dados do ${node}: ${error.message}`);
    return [];
  }
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (!checkElement(errorDiv, '#errorMessage')) return;
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  console.log('Erro exibido:', message);
}

function clearError() {
  const errorDiv = document.getElementById('errorMessage');
  if (!checkElement(errorDiv, '#errorMessage')) return;
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
  console.log('Erro limpo');
}

function checkElement(element, id) {
  if (!element) {
    console.error(`Elemento ${id} não encontrado`);
    return false;
  }
  return true;
}

function formatTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const [hours, minutes] = timeStr.split(':').map(num => parseInt(num.trim()) || 0);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function populateFiltersSheet1(dataClassification, dataSheet1, dataArtilharia) {
  console.log('Populando filtros para Placar, Classificação e Artilharia');
  const filters = [
    { id: 'time', indices: [4, 7], tab: 'placar' }, // Mandante e Visitante na aba Placar
    { id: 'time', indices: [2], tab: 'classification' }, // Time na aba Classificação
    { id: 'clube', indices: [2], tab: 'artilharia' }, // Clube na aba Artilharia
    { id: 'jogador', indices: [1], tab: 'artilharia' } // Jogador na aba Artilharia
  ];

  filters.forEach(filter => {
    const select = document.getElementById(`${filter.id}-${filter.tab}`);
    if (!checkElement(select, `#${filter.id}-${filter.tab}`)) return;

    select.innerHTML = '<option value="">Todos</option>';
    const data = filter.tab === 'placar' ? dataSheet1 : filter.tab === 'classification' ? dataClassification : dataArtilharia;
    const values = [...new Set(
      data.slice(1)
        .flatMap(row => filter.indices.map(index => row[index]?.trim()))
        .filter(v => v)
    )].sort();
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    console.log(`Filtro ${filter.id}-${filter.tab} populado com valores:`, values);
  });
}

function sortData(data, columnIndex, direction) {
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    let actualIndex = columnIndex;
    if (actualIndex >= 5) {
      actualIndex = actualIndex === 5 ? 5 : actualIndex === 6 ? 6 : actualIndex === 18 ? null : actualIndex;
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

function sortClassificationData(data) {
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    const indexA = parseInt(a[0]) || 0;
    const indexB = parseInt(b[0]) || 0;
    console.log(`Comparando: ${a[2]} (Índice ${indexA}) vs ${b[2]} (Índice ${indexB})`);
    return indexA - indexB;
  });
  return sortedData.slice(1);
}

function displayData(data, filteredData, page) {
  console.log(`Exibindo dados para ${page}`, filteredData);
  clearError();

  const tbody = document.querySelector(`#${page}Body`);
  const thead = document.querySelector(`#tableHead-${page}`);
  if (!checkElement(tbody, `#${page}Body`) || !checkElement(thead, `#tableHead-${page}`)) {
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
  console.log('Exibindo dados da Classificação');
  clearError();
  const tbody = document.getElementById('classificationBody');
  const thead = document.getElementById('tableHead-classification');
  if (!checkElement(tbody, '#classificationBody') || !checkElement(thead, '#tableHead-classification')) {
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const filters = {
    time: document.getElementById('time-classification')?.value || ''
  };
  console.log('Filtros coletados para Classificação:', filters);

  const filteredData = filterDataClassification(allDataClassification, filters);
  console.log('Dados filtrados para Classificação:', filteredData);

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

  if (filteredData.length === 0) {
    showError('Nenhum time encontrado com os filtros aplicados.');
  }
}

function filterDataSheet1(data, filters) {
  console.log('Aplicando filtros para placar:', filters);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let filteredRows = data.slice(1).filter((row, index) => {
    if (!row || row.length < 18) {
      console.log(`Linha ${index + 2} inválida:`, row);
      return false;
    }

    const [
      campeonato, dataStr, horario, ginasio, mandante, placar1, placar2, visitante,
      local, rodada, diaSemana, gol, assistencias, vitoria, derrota, empate, considerar, Index
    ] = row;

    let dataJogo = null;
    try {
      if (dataStr) {
        const [day, month, year] = dataStr.split('/');
        if (day && month && year && year.length === 4) {
          dataJogo = new Date(`${year}-${month}-${day}`);
          dataJogo.setHours(0, 0, 0, 0);
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

    if (dataJogo && dataJogo > today) {
      console.log(`Linha ${index + 2} ignorada (data futura): ${dataStr}`);
      return false;
    }

    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;
    const time = filters.time ? filters.time.trim() : '';

    const result = (
      (!dataInicio || (dataJogo && dataJogo >= dataInicio)) &&
      (!dataFim || (dataJogo && dataJogo <= dataFim)) &&
      (!time || mandante === time || visitante === time)
    );

    console.log(`Linha ${index + 2}: Data=${dataStr}, Mandante=${mandante}, Visitante=${visitante}, Time=${time}, Passou=${result}`);
    return result;
  }).sort((a, b) => {
    const indexA = parseInt(a[17]) || 0;
    const indexB = parseInt(b[17]) || 0;
    return indexA - indexB;
  });

  console.log('Dados filtrados e ordenados por Index:', filteredRows);
  return filteredRows;
}

function filterDataClassification(data, filters) {
  console.log('Aplicando filtros para classificação:', filters);

  let filteredRows = data.slice(1).filter((row, index) => {
    if (!row || row.length < 12) {
      console.log(`Linha ${index + 2} inválida:`, row);
      return false;
    }

    const time = filters.time ? filters.time.trim() : '';
    const teamName = row[2]; // Coluna 'Time' na classificação

    const result = (!time || teamName === time);
    console.log(`Linha ${index + 2}: Time=${teamName}, Filtro Time=${time}, Passou=${result}`);
    return result;
  }).sort((a, b) => {
    const indexA = parseInt(a[0]) || 0;
    const indexB = parseInt(b[0]) || 0;
    return indexA - indexB;
  });

  console.log('Dados filtrados e ordenados por Index:', filteredRows);
  return filteredRows;
}

function filterDataArtilharia(data, filters) {
  console.log('Aplicando filtros para artilharia:', filters);

  let filteredRows = data.slice(1).filter((row, index) => {
    if (!row || row.length < 4) {
      console.log(`Linha ${index + 2} inválida:`, row);
      return false;
    }

    const clube = filters.clube ? filters.clube.trim() : '';
    const jogador = filters.jogador ? filters.jogador.trim() : '';
    const rowClube = row[2]; // Coluna 'Clube' na artilharia
    const rowJogador = row[1]; // Coluna 'Jogador' na artilharia

    const result = (
      (!clube || rowClube === clube) &&
      (!jogador || rowJogador === jogador)
    );
    console.log(`Linha ${index + 2}: Clube=${rowClube}, Jogador=${rowJogador}, Filtro Clube=${clube}, Filtro Jogador=${jogador}, Passou=${result}`);
    return result;
  }).sort((a, b) => {
    const indexA = parseInt(a[0]) || 0;
    const indexB = parseInt(b[0]) || 0;
    return indexA - indexB;
  });

  console.log('Dados filtrados e ordenados por Index:', filteredRows);
  return filteredRows;
}

function displayPlacar() {
  const filters = {
    dataInicio: document.getElementById('dataInicio-placar')?.value || '',
    dataFim: document.getElementById('dataFim-placar')?.value || '',
    time: document.getElementById('time-placar')?.value || ''
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
  console.log('Exibindo dados da Artilharia');
  clearError();
  const tbody = document.getElementById('artilhariaBody');
  const thead = document.getElementById('tableHead-artilharia');
  if (!checkElement(tbody, '#artilhariaBody') || !checkElement(thead, '#tableHead-artilharia')) {
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const filters = {
    clube: document.getElementById('clube-artilharia')?.value || '',
    jogador: document.getElementById('jogador-artilharia')?.value || ''
  };
  console.log('Filtros coletados para Artilharia:', filters);

  const filteredData = filterDataArtilharia(allDataArtilharia, filters);
  console.log('Dados filtrados para Artilharia:', filteredData);

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

  if (filteredData.length === 0) {
    showError('Nenhum jogador encontrado com os filtros aplicados.');
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
    const elements = ['dataInicio-placar', 'dataFim-placar', 'time-placar'];
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    displayPlacar();
  } else if (tabId === 'classification') {
    const elements = ['dataInicio-classification', 'dataFim-classification', 'time-classification'];
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    displayClassification();
  } else if (tabId === 'artilharia') {
    const elements = ['clube-artilharia', 'jogador-artilharia'];
    elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    displayArtilharia();
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
      console.error('Erro ao carregar dados da artilharia');
      showError('Nenhum dado carregado para artilharia. Verifique o servidor.');
      return;
    }

    populateFiltersSheet1(allDataClassification, allDataSheet1, allDataArtilharia);
    console.log('Filtros populados');

    const classificationBtn = document.getElementById('classification-btn');
    const placarBtn = document.getElementById('placar-btn');
    const artilhariaBtn = document.getElementById('artilharia-btn');
    const aplicarFiltrosPlacarBtn = document.getElementById('aplicarFiltros-placar');
    const limparFiltrosPlacarBtn = document.getElementById('limparFiltros-placar');
    const aplicarFiltrosClassificationBtn = document.getElementById('aplicarFiltros-classification');
    const limparFiltrosClassificationBtn = document.getElementById('limparFiltros-classification');
    const aplicarFiltrosArtilhariaBtn = document.getElementById('aplicarFiltros-artilharia');
    const limparFiltrosArtilhariaBtn = document.getElementById('limparFiltros-artilharia');

    if (!checkElement(classificationBtn, '#classification-btn') ||
        !checkElement(placarBtn, '#placar-btn') ||
        !checkElement(artilhariaBtn, '#artilharia-btn') ||
        !checkElement(aplicarFiltrosPlacarBtn, '#aplicarFiltros-placar') ||
        !checkElement(limparFiltrosPlacarBtn, '#limparFiltros-placar') ||
        !checkElement(aplicarFiltrosClassificationBtn, '#aplicarFiltros-classification') ||
        !checkElement(limparFiltrosClassificationBtn, '#limparFiltros-classification') ||
        !checkElement(aplicarFiltrosArtilhariaBtn, '#aplicarFiltros-artilharia') ||
        !checkElement(limparFiltrosArtilhariaBtn, '#limparFiltros-artilharia')) {
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
    aplicarFiltrosPlacarBtn.addEventListener('click', () => {
      console.log('Botão Aplicar Filtros (Placar) clicado');
      displayPlacar();
    });
    limparFiltrosPlacarBtn.addEventListener('click', () => {
      console.log('Limpando filtros (Placar)');
      clearFilters('placar');
    });
    aplicarFiltrosClassificationBtn.addEventListener('click', () => {
      console.log('Botão Aplicar Filtros (Classificação) clicado');
      displayClassification();
    });
    limparFiltrosClassificationBtn.addEventListener('click', () => {
      console.log('Limpando filtros (Classificação)');
      clearFilters('classification');
    });
    aplicarFiltrosArtilhariaBtn.addEventListener('click', () => {
      console.log('Botão Aplicar Filtros (Artilharia) clicado');
      displayArtilharia();
    });
    limparFiltrosArtilhariaBtn.addEventListener('click', () => {
      console.log('Limpando filtros (Artilharia)');
      clearFilters('artilharia');
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