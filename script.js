console.log('script.js iniciado');

const API_KEY = 'AIzaSyB7mXFld0FYeZzr_0zNptLKxu2Sn3CEH2w';
const SPREADSHEET_ID = '1XAI5jFEFeXic73aFvOXYMs70SixhKlVhEriJup2G2FA';

let allDataSheet1 = [];
let allDataSheet2 = [];
let allDataSheet3 = [];
let allDataSheet4 = []; // Dados da aba Placar
let filteredDataTab1 = [];
let filteredDataTab2 = [];
let filteredDataTab3 = [];
let filteredDataTab4 = [];
let filteredDataTab5 = [];
let filteredDataTab6 = [];
let isPivotTab1 = false;
let isPivotTab2 = false;
let isPivotTab5 = false;
let convocacoesChart = null;
let sortConfigTab1 = { column: null, direction: 'asc' };
let sortConfigTab2 = { column: null, direction: 'asc' };
let sortConfigTab5 = { column: null, direction: 'asc' };
let sortConfigTab6 = { column: null, direction: 'asc' };

async function fetchSheetData(sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:R1000?key=${API_KEY}`;
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
        throw new Error(`Planilha ou aba ${sheetName} não encontrada (404). Verifique o ID da planilha ou a aba.`);
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

function populateFiltersSheet1(data) {
  console.log('Populando filtros da Sheet1 com', data.length, 'linhas');
  const filters = [
    { id: 'campeonato', index: 0 },
    { id: 'local', index: 8 },
    { id: 'rodada', index: 9 },
    { id: 'diaSemana', index: 10 },
    { id: 'gol', index: 11 },
    { id: 'assistencias', index: 12 },
  ];

  const tabs = ['tab1', 'tab2', 'tab6'];
  tabs.forEach(tab => {
    const timeSelect = document.getElementById(`time-${tab}`);
    if (timeSelect) {
      const mandantes = data.slice(1).map(row => row[4]?.trim()).filter(v => v);
      const visitantes = data.slice(1).map(row => row[7]?.trim()).filter(v => v);
      const times = [...new Set([...mandantes, ...visitantes])].sort();
      timeSelect.innerHTML = '<option value="">Todos</option>';
      times.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        timeSelect.appendChild(option);
      });
    }

    filters.forEach(filter => {
      if (tab === 'tab6' && ['local', 'rodada', 'diaSemana', 'gol', 'assistencias'].includes(filter.id)) return;
      const select = document.getElementById(`${filter.id}-${tab}`);
      if (select) {
        select.innerHTML = '<option value="">Todos</option>';
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

function populateFiltersSheet2(data) {
  console.log('Populando filtros da Sheet2 com', data.length, 'linhas');
  const filters = [
    { id: 'jogador', index: 0 },
    { id: 'adversario', index: 2 },
    { id: 'campeonato', index: 3 },
  ];

  const tab = 'tab4';
  filters.forEach(filter => {
    const select = document.getElementById(`${filter.id}-${tab}`);
    if (select) {
      select.innerHTML = '<option value="">Todos</option>';
      const values = [...new Set(data.slice(1).map(row => row[filter.index]?.trim()).filter(v => v))].sort();
      values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    }
  });
}

function populateFiltersSheet3(data) {
  console.log('Populando filtros da aba Classificação com', data.length, 'linhas');
  const filters = [
    { id: 'time', index: 1 },
  ];

  const tab = 'tab5';
  filters.forEach(filter => {
    const select = document.getElementById(`${filter.id}-${tab}`);
    if (select) {
      select.innerHTML = '<option value="">Todos</option>';
      const values = [...new Set(data.slice(1).map(row => row[filter.index]?.trim()).filter(v => v))].sort();
      values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    }
  });
}

function populateFiltersSheet4(data) {
  console.log('Populando filtros da aba Placar com', data.length, 'linhas');
  const filters = [
    { id: 'campeonato', index: 0 },
    { id: 'time', index: -1 }, // Mandante ou visitante
  ];

  const tab = 'tab6';
  filters.forEach(filter => {
    const select = document.getElementById(`${filter.id}-${tab}`);
    if (select) {
      select.innerHTML = '<option value="">Todos</option>';
      let values = [];
      if (filter.id === 'time') {
        const mandantes = data.slice(1).map(row => row[3]?.trim()).filter(v => v);
        const visitantes = data.slice(1).map(row => row[4]?.trim()).filter(v => v);
        values = [...new Set([...mandantes, ...visitantes])].sort();
      } else {
        values = [...new Set(data.slice(1).map(row => row[filter.index]?.trim()).filter(v => v))].sort();
      }
      values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    });
  }
}

function updateBigNumbers(data, tabId) {
  console.log(`Atualizando Big Numbers para ${tabId}`);
  let jogos = 0, gols = 0, assistencias = 0, vitorias = 0, empates = 0, derrotas = 0;

  data.forEach(row => {
    const placar1 = row[5];
    const considerar = row[16];
    const considerarValue = considerar !== undefined && considerar !== null ? String(considerar).trim() : '';
    const isValidConsiderar = considerarValue !== '0';
    const isValidPlacar1 = placar1 && placar1.trim() !== '';

    if (isValidConsiderar && isValidPlacar1) {
      jogos++;
    }
    if (isValidConsiderar) {
      if (row[11] && !isNaN(parseInt(row[11]))) {
        gols += parseInt(row[11]);
      }
      if (row[12] && !isNaN(parseInt(row[12]))) {
        assistencias += parseInt(row[12]);
      }
      vitorias += row[13] ? parseInt(row[13]) : 0;
      derrotas += row[14] ? parseInt(row[14]) : 0;
      empates += row[15] ? parseInt(row[15]) : 0;
    }
  });

  const media = jogos > 0 ? (gols / jogos).toFixed(2) : '0.00';
  const golACada = jogos > 0 && gols > 0 ? (jogos / gols).toFixed(2) : '0.00';

  const elements = {
    bigNumberJogos: document.getElementById(`bigNumberJogos-${tabId}`),
    bigNumberGols: document.getElementById(`bigNumberGols-${tabId}`),
    bigNumberAssistencias: document.getElementById(`bigNumberAssistencias-${tabId}`),
    bigNumberVitorias: document.getElementById(`bigNumberVitorias-${tabId}`),
    bigNumberEmpates: document.getElementById(`bigNumberEmpates-${tabId}`),
    bigNumberDerrotas: document.getElementById(`bigNumberDerrotas-${tabId}`),
    bigNumberMedia: document.getElementById(`bigNumberMedia-${tabId}`),
    bigNumberGolACada: document.getElementById(`bigNumberGolACada-${tabId}`),
  };

  if (elements.bigNumberJogos) elements.bigNumberJogos.textContent = jogos;
  if (elements.bigNumberGols) elements.bigNumberGols.textContent = gols;
  if (elements.bigNumberAssistencias) elements.bigNumberAssistencias.textContent = assistencias;
  if (elements.bigNumberVitorias) elements.bigNumberVitorias.textContent = vitorias;
  if (elements.bigNumberEmpates) elements.bigNumberEmpates.textContent = empates;
  if (elements.bigNumberDerrotas) elements.bigNumberDerrotas.textContent = derrotas;
  if (elements.bigNumberMedia) elements.bigNumberMedia.textContent = media;
  if (elements.bigNumberGolACada) elements.bigNumberGolACada.textContent = golACada;

  console.log(`Big Numbers atualizados (${tabId}):`, { jogos, gols, media, assistencias, golACada, vitorias, empates, derrotas });
}

function showUpcomingGames(data) {
  console.log('Verificando jogos para os próximos 3 dias');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(today.getDate() + 3);

  const upcomingGames = data.slice(1).filter(row => {
    const dataStr = row[1];
    if (!dataStr) return false;
    const gameDate = new Date(dataStr.split('/').reverse().join('-'));
    return gameDate >= today && gameDate <= threeDaysLater;
  });

  const upcomingGamesList = document.getElementById('upcomingGamesList'));
  const upcomingGamesDiv = document.getElementById('upcomingGames');
  if (!upcomingGamesList || !upcomingGamesDiv) {
    console.error('Erro: Elementos #upcomingGamesList ou #upcomingGames não encontrados');
    return;
  }
  upcomingGamesList.innerHTML = '';
  if (upcomingGames.length > 0) {
    upcomingGames.forEach(game => {
      const li = document.createElement('li');
      li.textContent = `${game[1]} às ${formatTime(game[2])}: ${game[4]} x ${game[7]} (${game[0]})`;
      upcomingGamesList.appendChild(li);
    });
    upcomingGamesDiv.style.display = 'block';
  } else {
    upcomingGamesDiv.style.display = 'none';
  }
  console.log(`Encontrados ${upcomingGames.length} jogos para os próximos 3 dias`);
}

function sortData(data, columnIndex, direction, tabId) {
  const sortedData = [...data];
  sortedData.sort((a, b) => {
    let actualIndex = columnIndex;
    if (tabId === 'tab1' && columnIndex >= 5) {
      actualIndex = columnIndex + 2;
    } else if (tabId === 'tab6' && columnIndex >= 5) {
      actualIndex = columnIndex === 5 ? 5 : 4; // Placar1 e Time (visitante)
    }

    let valueA = a[actualIndex] || '';
    let valueB = b[actualIndex] || '';

    if (actualIndex === 1) {
      valueA = valueA ? new Date(valueA.split('/').reverse().join('-')) : new Date(0);
      valueB = valueB ? new Date(valueB.split('/').reverse().join('-')) : new Date(0);
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    if ([actualIndex === 11 || actualIndex === 12 || actualIndex === 5 || actualIndex === 6]) {
      valueA = parseInt(valueA) || 0;
      valueB = parseInt(valueB) || 0;
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }

    if (tabId === 'tab5' && [0, 2, 3, 4, 5, 6, 7, 8, 9].includes(actualIndex)) {
      valueA = parseFloat(valueA) || 0;
      valueB = parseFloat(valueB) || 0;
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }
    if (tabId === 'tab5' && actualIndex === 10) {
      valueA = parseFloat(valueA.replace('%', '')) || 0;
      valueB = parseFloat(valueB.replace('%', '')) || 0;
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
  const tbody = document.getElementById(`jogosBody-${tabId}`);
  const thead = document.getElementById(`tableHead-${tabId}`);
  if (!tbody || !thead) {
    console.error(`Elementos #jogosBody-${tabId} ou #tableHead-${tabId} não encontrados`);
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  const trHead = document.createElement('tr');
  trHead.className = 'bg-gray-200';

  let headers;
  let sortConfig;
  if (tabId === 'tab1') {
    headers = ['Campeonato', 'Data', 'Horário', 'Ginásio', 'Mandante', 'Visitante', 'Local', 'Rodada', 'Dia da Semana'];
    sortConfig = sortConfigTab1;
  } else if (tabId === 'tab2') {
    headers = ['Campeonato', 'Data', 'Horário', 'Ginásio', 'Mandante', 'PP', 'PL', 'Visitante', 'Local', 'Rodada', 'Dia da Semana', 'Gol', 'Placar', 'Vitória', 'Pontos', 'Empate'];
    sortConfig = sortConfigTab2;
  } else if (tabId === 'tab5') {
    headers = ['#', 'Time', 'Pontos', 'Jogos', 'V', 'E', 'D', 'PP', 'PL', 'SG', 'Índice'];
    sortConfig = sortConfigTab5;
  } else if (tabId === 'tab6') {
    headers = ['Campeonato', 'Data', 'Horário', 'Mandante', 'Placar1', 'Placar2', 'Visitante'];
    sortConfig = sortConfigTab6;
  }

  headers.forEach((text, index) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.className = 'p-2 border sortable';
    th.dataset.index = index;
    if (sortConfig.column === index) {
      th.classList.add(sortConfig.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    th.addEventListener('click', () => {
      const newDirection = sortConfig.column === index && sortConfig.direction === 'asc' ? 'desc' : 'asc';
      if (tabId === 'tab1') {
        sortConfigTab1 = { column: index, direction: newDirection };
      } else if (tabId === 'tab2') {
        sortConfigTab2 = { column: index, direction: newDirection };
      } else if (tabId === 'tab5') {
        sortConfigTab5 = { column: index, direction: newDirection };
      } else if (tabId === 'tab6') {
        sortConfigTab6 = { column: index, direction: newDirection };
      }
      const sortedData = sortData(filteredData, index, newDirection, tabId);
      displayData(data, sortedData, tabId);
      console.log(`Ordenando por coluna ${text} (${index}) em ${newDirection} para ${tabId}`);
    });
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  console.log(`Total de linhas filtradas} (tabela normal) para ${tabId}:`, filteredData.length);
  if (filteredData.length === 0) {
    showError('Nenhum dado encontrado com os filtros aplicados ou dados não carregados.');
    return;
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
        if (vitoria) {
          tr.classList.add('victory-row');
        } else if (derrota) {
          tr.classList.add('defeat-row');
        } else if (empate) {
          tr.classList.add('draw-row');
        }
      }
    }

    let columnIndices;
    if (tabId === 'tab1') {
      columnIndices = [0, 1, 2, 3, 4, 7, 8, 9, 10];
    } else if (tabId === 'tab2') {
      columnIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    } else if (tabId === 'tab5') {
      columnIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    } else if (tabId === 'tab6') {
      columnIndices = [0, 1, 2, 3, 5, 6, 4];
    }

    columnIndices.forEach(index => {
      const td = document.createElement('td');
      const cell = row[index];
      if (index === 2 && (tabId === 'tab1' || tabId === 'tab2' || tabId === 'tab6')) {
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
  const tbody = document.getElementById(`jogosBody-${tabId}`);
  const thead = document.getElementById(`tableHead-${tabId}`);
  if (!tbody || !thead) {
    console.error(`Elementos #jogosBody-${tabId} ou #tableHead-${tabId} não encontrados`);
    showError('Erro interno: tabela não encontrada.');
    return;
  }
  tbody.innerHTML = '';
  thead.innerHTML = '';

  let headers;
  if (tabId === 'tab1') {
    headers = data[0].slice(0, 5).concat(data[0].slice(7, 11));
  } else if (tabId === 'tab2') {
    headers = data[0].slice(0, 16);
  } else if (tabId === 'tab5') {
    headers = data[0].slice(0, 11);
    headers[0] = '#';
  }
  console.log(`Cabeçalho para Transpor (${tabId}):`, headers);

  headers.forEach((header, colIndex) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = header;
    th.className = 'p-2 border bg-gray-200';
    tr.appendChild(th);

    filteredData.forEach(row => {
      const td = document.createElement('td');
      let actualIndex = colIndex;
      if (tabId === 'tab1') {
        actualIndex = colIndex < 5 ? colIndex : colIndex + 2;
      }
      let cellValue = row[actualIndex];
      if (actualIndex === 2 && (tabId === 'tab1' || tabId === 'tab2')) {
        cellValue = formatTime(cellValue);
      } else if (tabId === 'tab2' && [13, 14, 15].includes(actualIndex)) {
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

function filterDataSheet1(data, filters) {
  console.log('Aplicando filtros (Sheet1):', filters);

  return data.slice(1).filter((row, index) => {
    if (!row || row.length < 17) {
      console.log(`Linha ${index + 2} inválida:`, row);
      return false;
    }

    const [
      campeonato, dataStr, _, _, mandante, placar1, _, visitante, local, rodada, diaSemana, gol, _, vitoria, _, empate, considerar
    ] = row;

    const considerarValue = considerar !== undefined && considerar !== null ? String(considerar).trim().toLowerCase() : '';
    const isValidConsiderar = filters.considerar ? considerarValue === 'x' : considerarValue !== '0';
    console.log(`Linha ${index + 2}: Placar1=${placar1 || 'vazio'}, Considerar=${considerarValue || 'vazio'}, isValidConsiderar=${isValidConsiderar}, Incluída=${isValidConsiderar}`);

    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;
    const dataJogo = dataStr ? new Date(dataStr.split('/').reverse().join('-')) : null;

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

function filterDataSheet2(data, filters) {
  console.log('Aplicando filtros (Sheet2):', filters);

  return data.slice(1).filter((row, index) => {
    if (!row || row.length < 4) {
      console.log(`Linha ${index + 2} inválida na Sheet2:`, row);
      return false;
    }

    const [jogador, dataStr, adversario, campeonato] = row;

    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;
    const dataJogo = dataStr ? new Date(dataStr.split('/').reverse().join('-')) : null;

    return (
      (!filters.jogador || jogador === filters.jogador) &&
      (!filters.adversario || adversario === filters.adversario) &&
      (!filters.campeonato || campeonato === filters.campeonato) &&
      (!dataInicio || (dataStr && dataJogo >= dataInicio)) &&
      (!dataFim || (dataStr && dataJogo <= dataFim)))
    );
  });
}

function filterDataSheet3(data, filters) {
  console.log('Aplicando filtros (Sheet3 - Classificação):', filters);

  return data.slice(1).filter((row, index) => {
    if (!row || row.length < 11) {
      console.log(`Linha ${index + 2} inválida na aba Classificação:`, row);
      return false;
    }

    const [posicao, time, pontos, jogos, vitorias, empates, derrotas, golsPro, golsContra, saldo, aproveitamento] = row;

    return (
      (!filters.time || time === filters.time)
    );
  });
}

function filterDataSheet4(data, filters) {
  console.log('Aplicando filtros (Placar):', filters);

  return data.slice(1).filter((row, index) => {
    if (!row || row.length < 7) {
      console.log(`Linha ${index + 2} inválida na aba Placar:`, row);
      return false;
    const [
      campeonato, dataStr, horario, mandante, visitante, placar1, placar2
    ] = row;

    const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
    const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;
    const dataJogo = dataStr ? new Date(dataStr.split('/').reverse().join('-')) : null;

    return (
      (!filters.campeonato || campeonato === filters.campeonato) &&
      (!dataInicio || (dataJogo && dataJogo >= dataInicio)) &&
      (!dataFim || (dataJogo && dataJogo <= dataFim)) &&
      (!filters.time || mandante === filters.time || visitante === filters.time))
    );
  });
}

function displayTab1() {
  const filters = {
    campeonato: document.getElementById('campeonato-tab1')?.value || '',
    dataInicio: document.getElementById('dataInicio-tab1')?.value || '',
    dataFim: document.getElementById('dataFim-tab1')?.value || '',
    considerar: true
  };
  filteredDataTab1 = filterDataSheet1(allDataSheet1, filters);
  if (isPivotTab1) {
    pivotTable(allDataSheet1, filteredDataTab1, 'tab1');
    document.getElementById('pivotMode-tab1').textContent = 'Tabela';
  } else {
    displayData(allDataSheet1, filteredDataTab1, 'tab1');
    document.getElementById('pivotMode-tab1').textContent = 'Transpor');
  }
}

function displayTab2() {
  const filters = {
    campeonato: document.getElementById('campeonato-tab2')?.value || '',
    dataInicio: document.getElementById('dataInicio-tab2')?.value || '',
    dataFim: document.getElementById('dataFim-tab2')?.value || '',
    time: document.getElementById('time-tab2')?.value || '',
    local: document.getElementById('local-tab2')?.value || '',
    rodada: document.getElementById('rodada-tab2')?.value || '',
    diaSemana: document.getElementById('diaSemana-tab2')?.value || '',
    gol: document.getElementById('gol-tab2')?.value || '',
    assistencias: document.getElementById('assistencias-tab2')?.value || '',
    vitoria: document.getElementById('vitoria-tab2')?.value || '',
    empate: document.getElementById('empate-tab2')?.value || '',
    derrota: document.getElementById('derrota-tab2')?.value || ''
  };
  filteredDataTab2 = filterDataSheet1(allDataSheet1, filters);
  if (isPivotTab2) {
    pivotTable(allDataSheet1, filteredDataTab2, 'tab2');
    document.getElementById('pivotMode-tab2').textContent = 'Tabela';
  } else {
    displayData(allDataSheet1, filteredDataTab2, 'tab2');
    document.getElementById('pivotMode-tab2').textContent = 'Transpor';
  }
}

function displayTab3() {
  filteredDataTab3 = allDataSheet1.slice(1);
  updateBigNumbers(filteredDataTab3, 'tab3');
}

function displayTab4() {
  const filters = {
    jogador: document.getElementById('jogador-tab4')?.value || '',
    adversario: document.getElementById('adversario-tab4')?.value || '',
    campeonato: document.getElementById('campeonato-tab4')?.value || '',
    dataInicio: document.getElementById('dataInicio-tab4')?.value || '',
    dataFim: document.getElementById('dataFim-tab4')?.value || ''
  };
  filteredDataTab4 = filterDataSheet2(allDataSheet2, filters);

  const convocacoesPorJogador = {};
  filteredDataTab4.forEach(row => {
    const jogador = row[0];
    if (jogador) {
      convocacoesPorJogador[jogador] = (convocacoesPorJogador[jogador] || 0) + 1;
    }
  });

  const jogadoresOrdenados = Object.keys(convocacoesPorJogador).sort((a, b) => {
    return convocacoesPorJogador[b] - convocacoesPorJogador[a];
  });

  const contagens = jogadoresOrdenados.map(jogador => convocacoesPorJogador[jogador]);

  const canvas = document.getElementById('convocacoesChart');
  const numJogadores = jogadoresOrdenados.length;
  const alturaPorJogador = 40;
  const novaAltura = numJogadores * alturaPorJogador;
  canvas.style.height = `${novaAltura}px`;

  if (convocacoesChart) {
    convocacoesChart.destroy();
  }

  const ctx = canvas.getContext('2d');
  convocacoesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: jogadoresOrdenados,
      datasets: [{
        label: '',
        data: contagens,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#1d4ed8',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          anchor: 'center',
          align: 'start',
          color: '#fff',
          font: {
            weight: 'bold',
            size: 8
          },
          formatter: (value, context) => {
            return context.chart.data.labels[context.dataIndex];
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: false
          },
          ticks: {
            stepSize: 1
          }
        },
        y: {
          display: true,
          title: {
            display: false
          },
          ticks: {
            display: false
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  if (jogadoresOrdenados.length === 0) {
    showError('Nenhum dado encontrado com os filtros aplicados.');
  } else {
    clearError();
  }
}

function displayTab5() {
  const filters = {
    time: document.getElementById('time-tab5')?.value || ''
  };
  filteredDataTab5 = filterDataSheet3(allDataSheet3, filters);
  if (isPivotTab5) {
    pivotTable(allDataSheet3, filteredDataTab5, 'tab5');
    document.getElementById('pivotMode-tab5').textContent = 'Tabela';
  } else {
    displayData(allDataSheet3, filteredDataTab5, 'tab5');
    document.getElementById('pivotMode-tab5').textContent = 'Transpor';
  }
}

function displayTab6() {
  const filters = {
    campeonato: document.getElementById('campeonato-tab6')?.value || '',
    dataInicio: document.getElementById('dataInicio-tab6')?.value || '',
    dataFim: document.getElementById('dataFim-tab6')?.value || '',
    time: document.getElementById('time-tab6')?.value || ''
  };
  filteredDataTab6 = filterDataSheet4(allDataSheet4, filters);
  displayData(allDataSheet4, filteredDataTab6, 'tab6');
}

function clearFilters(tabId) {
  const tabs = tabId ? [tabId] : ['tab1', 'tab2', 'tab4', 'tab5', 'tab6'];
  tabs.forEach(tab => {
    const campeonato = document.getElementById(`campeonato-${tab}`);
    const dataInicio = document.getElementById(`dataInicio-${tab