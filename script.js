console.log('script.js iniciado');

const API_KEY = 'AIzaSyB7mXFld0FYeZzr_0zNptLKxu2Sn3CEH2w';
const SPREADSHEET_ID = '1XAI5jFEFeXic73aFvOXYMs70SixhKlVhEriJup2G2FA';

let allDataSheet1 = []; // Dados da Sheet1 (Tabela e Placar)
let allDataClassification = []; // Dados da aba Futsal Classificação
let filteredDataTab2 = []; // Tabela
let filteredDataPlacar = []; // Placar
let isPivotTab2 = false; // Estado do Transpor para Tabela
let sortConfigTab2 = { column: null, direction: 'asc' };
let sortConfigPlacar = { column: null, direction: 'asc' };

async function fetchSheetData(sheetName, spreadsheetId = SPREADSHEET_ID) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:R1000?key=${API_KEY}`;
  console.log(`Iniciando requisição à API para ${sheetName}:`, url);
  try {
    const response = await fetch(url, { mode: 'cors' });
    console.log(`Resposta recebida para ${sheetName}:`, response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Detalhes do erro:', errorText);
      if (response.status === 403) {
        throw new Error('Acesso negado (403). Verifique se a planilha está pública e se a chave API tem permissão.');
      } else if (response.status === 404) {
        throw new Error(`Planilha ou aba ${sheetName} não encontrada (404). Verifique se a aba "${sheetName}" existe na planilha com ID ${spreadsheetId}.`);
      } else if (response.status === 429) {
        throw new Error('Limite de requisições excedido (429). Tente novamente mais tarde.');
      } else {
        throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
      }
    }
    const data = await response.json();
    console.log(`Dados brutos (${sheetName}):`, data);
    if (!data.values || data.values.length === 0) {
      throw new Error(`Nenhum dado retornado. A aba ${sheetName} está vazia ou não existe.`);
    }
    console.log(`Linhas recebidas (${sheetName}):`, data.values.length);
    return data.values;
  } catch (error) {
    console.error(`Erro ao buscar dados da ${sheetName}:`, error.message);
    showError(`Erro ao carregar dados da ${sheetName}: ${error.message}`);
    return [];
  }
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    console.log('Erro exibido:', message);
  } else {
    console.error('Elemento #errorMessage não encontrado');
  }
}

function clearError() {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
    console.log('Erro limpo');
  }
}

function formatTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const [hours, minutes] = timeStr.split(':').map(num => parseInt(num) || 0);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function populateFiltersSheet1(data, tabs) {
  console.log('Populando filtros da Sheet1 com', data.length, 'linhas');
  const filters = [
    { id: 'campeonato', index: 0 },
    { id: 'local', index: 8 },
    { id: 'rodada', index: 9 },
    { id: 'diaSemana', index: 10 },
    { id: 'gol', index: 11 },
    { id: 'assistencias', index: 12 },
    { id: 'time', index: -1 } // Especial para time (mandante ou visitante)
  ];

  tabs.forEach(tab => {
    const timeSelect = document.getElementById(`time-${tab}`);
    if (timeSelect) {
      const mandantes = data.slice(1).map(row => row[4]?.trim()).filter(v => v);
      const visitantes = data.slice(1).map(row => row[7]?.trim()).filter(v => v);
      const times = [...new Set([...mandantes, ...visitantes])].sort();
      times.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        timeSelect.appendChild(option);
      });
    }

    filters.forEach(filter => {
      if (filter.id === 'time' && tab === 'placar') return; // Time já tratado acima
      if (tab === 'placar' && ['gol', 'assistencias', 'diaSemana', 'rodada', 'local'].includes(filter.id)) return; // Placar tem menos filtros
      const select = document.getElementById(`${filter.id}-${tab}`);
      if (select) {
        const values = [...new Set(data.slice(1).map(row => row[filter.index]?.trim()).filter(v => v))].sort();
        values.forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });
      }
    });
  });
}

function sortData(data, columnIndex, direction, tabId) {
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    let actualIndex = columnIndex;
    if (tabId === 'placar' && columnIndex >= 5) {
      actualIndex = columnIndex === 5 ? 5 : 6; // Ajusta para Placar1 e Placar2
    }

    let valueA = a[actualIndex] || '';
    let valueB = b[actualIndex] || '';

    if (actualIndex === 1) {
      valueA = valueA ? new Date(valueA.split('/').reverse().join('-')) : new Date(0);
      valueB = valueB ? new Date(valueB.split('/').reverse().join('-')) : new Date(0);
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    if ([11, 12, 5, 6].includes(actualIndex)) {
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

function displayData(data, filteredData, tabId) {
  console.log(`Exibindo dados (modo tabela normal) para ${tabId}`);
  clearError();
  const tbody = document.getElementById(`${tabId === 'tab2' ? 'jogosBody-tab2' : 'placarBody'}`);
  const thead = document.getElementById(`tableHead-${tabId}`);
  if (!tbody || !thead) {
    console.error(`Elementos #${tabId === 'tab2' ? 'jogosBody-tab2' : 'placarBody'} ou #tableHead-${tabId} não encontrados`);
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const trHead = document.createElement('tr');
  trHead.className = 'bg-gray-200';
  const headers = tabId === 'tab2'
    ? ['Campeonato', 'Data', 'Horário', 'Ginásio', 'Mandante', '', '', 'Visitante', 'Local', 'Rodada', 'Dia da Semana', 'Gol', 'Assistências', 'Vitória', 'Derrota', 'Empate']
    : ['Campeonato', 'Data', 'Horário', 'Ginásio', 'Mandante', 'Placar1', 'Placar2', 'Visitante'];
  const sortConfig = tabId === 'tab2' ? sortConfigTab2 : sortConfigPlacar;
  headers.forEach((text, index) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.className = 'p-2 sortable';
    th.dataset.index = index;
    if (sortConfig.column === index) {
      th.classList.add(sortConfig.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    th.addEventListener('click', () => {
      const newDirection = sortConfig.column === index && sortConfig.direction === 'asc' ? 'desc' : 'asc';
      if (tabId === 'tab2') {
        sortConfigTab2 = { column: index, direction: newDirection };
      } else {
        sortConfigPlacar = { column: index, direction: newDirection };
      }
      const sortedData = sortData(filteredData, index, newDirection, tabId);
      displayData(data, sortedData, tabId);
      console.log(`Ordenando por coluna ${text} (${index}) em ordem ${newDirection} para ${tabId}`);
    });
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  console.log(`Total de linhas filtradas (tabela normal) para ${tabId}:`, filteredData.length);
  if (filteredData.length === 0) {
    showError('Nenhum jogo encontrado com os filtros aplicados ou dados não carregados.');
  }

  let hasInconsistency = false;
  filteredData.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    if (tabId === 'tab2') {
      const vitoria = row[13] === '1';
      const derrota = row[14] === '1';
      const empate = row[15] === '1';
      const conditions = [vitoria, derrota, empate].filter(Boolean).length;
      if (conditions > 1) {
        console.warn(`Inconsistência nos dados da linha ${rowIndex + 2}: Vitória=${row[13]}, Derrota=${row[14]}, Empate=${row[15]}`);
        hasInconsistency = true;
      } else if (conditions === 1) {
        if (vitoria) tr.classList.add('victory-row');
        else if (derrota) tr.classList.add('defeat-row');
        else if (empate) tr.classList.add('draw-row');
      }
    }

    const columnIndices = tabId === 'tab2'
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      : [0, 1, 2, 3, 4, 5, 6, 7];

    columnIndices.forEach(index => {
      const td = document.createElement('td');
      const cell = row[index];
      if (index === 2) {
        td.textContent = formatTime(cell);
      } else if (tabId === 'tab2' && [13, 14, 15].includes(index)) {
        td.textContent = cell === '1' ? 'Sim' : '';
      } else {
        td.textContent = cell || '';
      }
      td.className = 'p-2 border';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  if (hasInconsistency && tabId === 'tab2') {
    showError('Inconsistência nos dados: Algumas linhas possuem mais de um resultado (Vitória, Derrota, Empate). Corrija a planilha.');
  }
}

function pivotTable(data, filteredData, tabId) {
  console.log(`Transformando tabela para formato Transpor para ${tabId}`);
  clearError();
  const tbody = document.getElementById(`jogosBody-tab2`);
  const thead = document.getElementById(`tableHead-tab2`);
  if (!tbody || !thead) {
    console.error(`Elementos #jogosBody-tab2 ou #tableHead-tab2 não encontrados`);
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const headers = data[0].slice(0, 16);
  console.log(`Cabeçalho para Transpor (${tabId}):`, headers);

  headers.forEach((header, colIndex) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = header;
    th.className = 'p-2 border bg-gray-200';
    tr.appendChild(th);

    filteredData.forEach(row => {
      const td = document.createElement('td');
      let cellValue = row[colIndex];
      if (colIndex === 2) {
        cellValue = formatTime(cellValue);
      } else if ([13, 14, 15].includes(colIndex)) {
        cellValue = cellValue === '1' ? 'Sim' : '';
      } else {
        cellValue = cellValue || '';
      }
      td.textContent = cellValue;
      td.className = 'p-2 border';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  console.log(`Tabela transformada para formato Transpor (${tabId})`);
}

function displayClassification() {
  console.log('Exibindo dados da Classificação');
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
  const headers = allDataClassification[0] || ['Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Pró', 'Gols Contra', 'Saldo'];
  headers.forEach((text, index) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.className = 'p-2';
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const filteredData = allDataClassification.slice(1);
  console.log('Total de linhas na Classificação:', filteredData.length);
  if (filteredData.length === 0) {
    showError('Nenhum dado de classificação encontrado na aba "Futsal Classificação". Verifique se a aba existe e contém dados.');
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

function filterDataSheet1(data, filters, tabId) {
  console.log(`Aplicando filtros (Sheet1) para ${tabId}:`, filters);

  return data.slice(1).filter((row, index) => {
    if (!row || row.length < 17) {
      console.log(`Linha ${index + 2} inválida:`, row);
      return false;
    }

    const [
      campeonato, dataStr, horario, ginasio, mandante, placar1, placar2, visitante, local, rodada, diaSemana, gol, assistencias, vitoria, derrota, empate, considerar
    ] = row;

    const considerarValue = considerar !== undefined && considerar !== null ? String(considerar).trim().toLowerCase() : '';
    const isValidConsiderar = considerarValue !== '0';
    console.log(`Linha ${index + 2}: Placar1=${placar1 || 'vazio'}, Considerar=${considerarValue || 'vazio'}, isValidConsiderar=${isValidConsiderar}, Incluída=${isValidConsiderar}`);

    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;
    const dataJogo = dataStr ? new Date(dataStr.split('/').reverse().join('-')) : null;

    if (tabId === 'placar') {
      return (
        isValidConsiderar &&
        (!filters.campeonato || campeonato === filters.campeonato) &&
        (!dataInicio || (dataJogo && dataJogo >= dataInicio)) &&
        (!dataFim || (dataJogo && dataJogo <= dataFim)) &&
        (!filters.time || mandante === filters.time || visitante === filters.time)
      );
    }

    return (
      isValidConsiderar &&
      (!filters.campeonato || campeonato === filters.campeonato) &&
      (!dataInicio || (dataJogo && dataJogo >= dataInicio)) &&
      (!dataFim || (dataJogo && dataJogo <= dataFim)) &&
      (!filters.time || mandante === filters.time || visitante === filters.time) &&
      (!filters.local || local === filters.local) &&
      (!filters.rodada || rodada === filters.rodada) &&
      (!filters.diaSemana || diaSemana === filters.diaSemana) &&
      (!filters.gol || gol === filters.gol) &&
      (!filters.assistencias || assistencias === filters.assistencias) &&
      (!filters.vitoria || vitoria === filters.vitoria) &&
      (!filters.empate || empate === filters.empate) &&
      (!filters.derrota || derrota === filters.derrota)
    );
  });
}

function displayTab2() {
  const filters = {
    campeonato: document.getElementById('campeonato-tab2').value,
    dataInicio: document.getElementById('dataInicio-tab2').value,
    dataFim: document.getElementById('dataFim-tab2').value,
    time: document.getElementById('time-tab2').value,
    local: document.getElementById('local-tab2').value,
    rodada: document.getElementById('rodada-tab2').value,
    diaSemana: document.getElementById('diaSemana-tab2').value,
    gol: document.getElementById('gol-tab2').value,
    assistencias: document.getElementById('assistencias-tab2').value,
    vitoria: document.getElementById('vitoria-tab2').value,
    empate: document.getElementById('empate-tab2').value,
    derrota: document.getElementById('derrota-tab2').value
  };
  filteredDataTab2 = filterDataSheet1(allDataSheet1, filters, 'tab2');
  if (isPivotTab2) {
    pivotTable(allDataSheet1, filteredDataTab2, 'tab2');
    document.getElementById('pivotMode-tab2').textContent = 'Tabela';
  } else {
    displayData(allDataSheet1, filteredDataTab2, 'tab2');
    document.getElementById('pivotMode-tab2').textContent = 'Transpor';
  }
}

function displayPlacar() {
  const filters = {
    campeonato: document.getElementById('campeonato-placar').value,
    dataInicio: document.getElementById('dataInicio-placar').value,
    dataFim: document.getElementById('dataFim-placar').value,
    time: document.getElementById('time-placar').value
  };
  filteredDataPlacar = filterDataSheet1(allDataSheet1, filters, 'placar');
  displayData(allDataSheet1, filteredDataPlacar, 'placar');
}

function clearFilters(tabId) {
  if (tabId === 'tab2') {
    document.getElementById('campeonato-tab2').value = '';
    document.getElementById('dataInicio-tab2').value = '';
    document.getElementById('dataFim-tab2').value = '';
    document.getElementById('time-tab2').value = '';
    document.getElementById('local-tab2').value = '';
    document.getElementById('rodada-tab2').value = '';
    document.getElementById('diaSemana-tab2').value = '';
    document.getElementById('gol-tab2').value = '';
    document.getElementById('assistencias-tab2').value = '';
    document.getElementById('vitoria-tab2').value = '';
    document.getElementById('empate-tab2').value = '';
    document.getElementById('derrota-tab2').value = '';
    isPivotTab2 = false;
    displayTab2();
  } else if (tabId === 'placar') {
    document.getElementById('campeonato-placar').value = '';
    document.getElementById('dataInicio-placar').value = '';
    document.getElementById('dataFim-placar').value = '';
    document.getElementById('time-placar').value = '';
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

  if (tabId === 'tab2') displayTab2();
  else if (tabId === 'classification') displayClassification();
  else if (tabId === 'placar') displayPlacar();
}

async function init() {
  console.log('Inicializando aplicação');
  try {
    allDataSheet1 = await fetchSheetData('Sheet1');
    allDataClassification = await fetchSheetData('Futsal Classificação');

    if (allDataSheet1.length === 0) {
      console.error('Nenhum dado retornado da Sheet1');
      showError('Nenhum dado disponível na Sheet1. Verifique a conexão, chave API ou planilha.');
      return;
    }
    if (allDataClassification.length === 0) {
      console.error('Nenhum dado retornado da aba Futsal Classificação');
      showError('Nenhum dado disponível na aba Futsal Classificação. Verifique se a aba existe e contém dados na planilha com ID 1XAI5jFEFeXic73aFvOXYMs70SixhKlVhEriJup2G2FA.');
      return;
    }

    populateFiltersSheet1(allDataSheet1, ['tab2', 'placar']);

    const tab2Btn = document.getElementById('tab2-btn');
    const classificationBtn = document.getElementById('classification-btn');
    const placarBtn = document.getElementById('placar-btn');

    if (!tab2Btn || !classificationBtn || !placarBtn) {
      console.error('Botões de navegação não encontrados:', { tab2Btn, classificationBtn, placarBtn });
      showError('Erro interno: botões de navegação não encontrados.');
      return;
    }

    tab2Btn.addEventListener('click', () => {
      console.log('Clique no botão da Tabela');
      showTab('tab2');
    });
    classificationBtn.addEventListener('click', () => {
      console.log('Clique no botão da Classificação');
      showTab('classification');
    });
    placarBtn.addEventListener('click', () => {
      console.log('Clique no botão do Placar');
      showTab('placar');
    });

    document.getElementById('aplicarFiltros-tab2').addEventListener('click', () => {
      console.log('Aplicando filtros (Tab 2)');
      displayTab2();
    });

    document.getElementById('limparFiltros-tab2').addEventListener('click', () => {
      console.log('Limpando filtros (Tab 2)');
      clearFilters('tab2');
    });

    document.getElementById('pivotMode-tab2').addEventListener('click', () => {
      console.log('Botão Transpor clicado (Tab 2)');
      isPivotTab2 = !isPivotTab2;
      displayTab2();
    });

    document.getElementById('aplicarFiltros-placar').addEventListener('click', () => {
      console.log('Aplicando filtros (Placar)');
      displayPlacar();
    });

    document.getElementById('limparFiltros-placar').addEventListener('click', () => {
      console.log('Limpando filtros (Placar)');
      clearFilters('placar');
    });

    showTab('tab2');
  } catch (error) {
    console.error('Erro na inicialização:', error.message);
    showError(`Erro na inicialização: ${error.message}`);
  }
}

init();