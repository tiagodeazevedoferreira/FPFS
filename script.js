
console.log('Script.js iniciado');

const FIREBASE_URL = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/';
const CACHE_DURATION = 3600000; // 1 hora em milissegundos
let allDataSheet1 = []; // Dados do nó jogos (Placar)
let allDataClassification = []; // Dados do nó classificacao
let filteredDataPlacar = []; // Placar
let sortConfigPlacar = { column: 18, direction: 'asc' }; // Default to Index column
let allDataArtilharia = []; // Dados do nó artilharia
let estatisticasChart = null; // Referência ao gráfico combinado na aba Estatísticas
let golsPorTimeChart2 = null; // Referência ao gráfico combinado na aba Estatísticas 2
let timesApelidos = {}; // Mapa de times/clubes para apelidos
let sortConfigEstatisticas = { mode: 'classificacao' }; // Modo de ordenação para Estatísticas
let sortConfigEstatisticas2 = { mode: 'classificacao' }; // Modo de ordenação para Estatísticas 2

// Plugin para centralizar ambas as barras na categoria
const overlapBars = {
    id: 'overlapBars',
    beforeDatasetsDraw(chart) {
        const { scales } = chart;
        const xScale = scales.x;
        const datasets = chart.data.datasets;

        datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta.hidden) { // Apenas para datasets visíveis
                meta.data.forEach((bar, index) => {
                    const barWidth = dataset.barThickness; // Largura da barra atual
                    const centerX = xScale.getPixelForTick(index); // Centro da categoria
                    bar.x = centerX; // Centraliza ambas as barras na categoria
                });
            }
        });
    }
};

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function normalizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

async function fetchTimesApelidos() {
    const cacheKey = 'times_apelidos_cache';
    const cachedData = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(`${cacheKey}_time`);
    if (cachedData && cacheTime && Date.now() - cacheTime < CACHE_DURATION) {
        timesApelidos = JSON.parse(cachedData);
        console.log('Mapa de times_apelidos carregado do cache:', timesApelidos);
        return timesApelidos;
    }
    const url = `${FIREBASE_URL}times_apelidos.json?cacheBuster=${Date.now()}`;
    console.log('Iniciando requisição ao Firebase para times_apelidos:', url);
    try {
        const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
        if (!response.ok) throw new Error(`Erro ao carregar times_apelidos: ${response.status}`);
        const data = await response.json();
        if (!data || Object.keys(data).length === 0) {
            console.warn('Nenhum dado retornado para times_apelidos.');
            showError('Tabela de apelidos vazia. Usando nomes originais.');
            return {};
        }
        const apelidosMap = {};
        Object.entries(data).forEach(([key, row]) => {
            if (row['Time'] && row['Apelido'] && typeof row['Time'] === 'string' && typeof row['Apelido'] === 'string') {
                apelidosMap[row['Time']] = row['Apelido'];
                console.log(`Mapeado: ${row['Time']} -> ${row['Apelido']}`);
            } else {
                console.warn(`Entrada inválida em times_apelidos (chave ${key}):`, row);
            }
        });
        localStorage.setItem(cacheKey, JSON.stringify(apelidosMap));
        localStorage.setItem(`${cacheKey}_time`, Date.now());
        console.log('Mapa de times_apelidos:', apelidosMap);
        return apelidosMap;
    } catch (error) {
        console.error('Erro ao buscar times_apelidos:', error.message);
        showError(`Erro ao carregar times_apelidos: ${error.message}. Usando nomes originais.`);
        return {};
    }
}

async function fetchFirebaseData(node) {
    const url = `${FIREBASE_URL}${node}.json?cacheBuster=${Date.now()}`;
    console.log(`Iniciando requisição ao Firebase para ${node}:`, url);
    try {
        const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        if (!data || Object.keys(data).length === 0) throw new Error(`Nó ${node} vazio ou não existe.`);
        let dataArray = [];
        if (node === 'jogos') {
            const headers = ['Campeonato', 'Data', 'Horário', 'Ginásio', 'Mandante', 'Placar 1', 'Placar 2', 'Visitante', 'Local', 'Rodada', 'Dia da Semana', 'Gol', 'Assistências', 'Vitória', 'Derrota', 'Empate', 'considerar', 'Index'];
            dataArray.push(headers);
            const seenRows = new Set();
            Object.entries(data).forEach(([key, row]) => {
                if (!row['Mandante'] || !row['Visitante'] || !row['Data']) {
                    console.warn(`Linha inválida (chave ${key}):`, row);
                    return;
                }
                const index = parseInt(key.split('_').pop()) || 0;
                const mandante = timesApelidos[row['Mandante']] || row['Mandante'];
                const visitante = timesApelidos[row['Visitante']] || row['Visitante'];
                const ginásio = toTitleCase(row['Ginásio'] || '');
                console.log(`Jogos - Mandante: ${row['Mandante']} -> ${mandante}, Visitante: ${row['Visitante']} -> ${visitante}, Ginásio: ${row['Ginásio']} -> ${ginásio}`);
                const rowArray = [
                    'FPFS Sub-9 2025', row['Data'] || '', row['Horário'] || '', ginásio,
                    mandante, row['Placar 1'] || '', row['Placar 2'] || '', visitante,
                    '', '', '', '', '',
                    row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) > parseInt(row['Placar 2']) ? '1' : '0') : '',
                    row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) < parseInt(row['Placar 2']) ? '1' : '0') : '',
                    row['Placar 1'] && row['Placar 2'] ? (parseInt(row['Placar 1']) === parseInt(row['Placar 2']) ? '1' : '0') : '',
                    row['Considerar'] || '1', index
                ];
                const rowKey = `${rowArray[1]}-${rowArray[4]}-${rowArray[7]}-${rowArray[5]}-${rowArray[6]}-${index}`;
                if (!seenRows.has(rowKey)) {
                    seenRows.add(rowKey);
                    dataArray.push(rowArray);
                } else {
                    console.warn(`Linha duplicada detectada e ignorada: ${rowKey}`);
                }
            });
        } else if (node === 'classificacao') {
            const headers = ['Index', 'Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Próprio', 'Gols Contra', 'Saldo', 'Aproveitamento'];
            dataArray.push(headers);
            Object.entries(data).forEach(([key, row]) => {
                if (key === '0' || !row['2']) {
                    console.warn(`Linha inválida (chave ${key}):`, row);
                    return;
                }
                const index = parseInt(key.split('_').pop()) || 0;
                const time = timesApelidos[row['2']] || row['2'];
                console.log(`Classificação - Time: ${row['2']} -> ${time}`);
                dataArray.push([index, row['1'] || '', time, row['3'] || '', row['4'] || '', row['5'] || '', row['6'] || '', row['7'] || '', row['8'] || '', row['9'] || '', row['10'] || '', row['11'] || '']);
            });
        } else if (node === 'artilharia') {
            const headers = ['#', 'Jogador', 'Clube', 'Gols'];
            dataArray.push(headers);
            Object.entries(data).forEach(([key, row]) => {
                if (!row['2'] || !row['1']) {
                    console.warn(`Linha inválida (chave ${key}):`, row);
                    return;
                }
                const index = parseInt(key.split('_').pop()) || 0;
                const clube = timesApelidos[row['2']] || row['2'];
                const jogador = toTitleCase(row['1'] || '');
                console.log(`Artilharia - Clube: ${row['2']} -> ${clube}, Jogador: ${row['1']} -> ${jogador}`);
                dataArray.push([index, jogador, clube, row['3'] || '']);
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
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        console.log('Erro exibido:', message);
    }
}

function clearError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.classList.add('hidden');
        console.log('Erro limpo');
    }
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

function populateFilters() {
    console.log('Populando filtros');
    const filters = [
        { id: 'time', indices: [4, 7], tab: 'placar' },
        { id: 'time', indices: [2], tab: 'classification' },
        { id: 'clube', indices: [2], tab: 'artilharia' },
        { id: 'jogador', indices: [1], tab: 'artilharia' },
        { id: 'clube', indices: [2], tab: 'estatisticas' },
        { id: 'jogador', indices: [1], tab: 'estatisticas' },
        { id: 'clube', indices: [2], tab: 'estatisticas2' },
    ];
    filters.forEach(filter => {
        const select = document.getElementById(`${filter.id}-${filter.tab}`);
        if (!checkElement(select, `#${filter.id}-${filter.tab}`)) return;
        select.innerHTML = '<option value="">Todos</option>';
        const data = filter.tab === 'placar' ? allDataSheet1 : filter.tab === 'classification' ? allDataClassification : allDataArtilharia;
        const values = [...new Set(data.slice(1).flatMap(row => filter.indices.map(index => row[index]?.trim())).filter(v => v))].sort();
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
    headers.forEach((text, idx) => {
        const th = document.createElement('th');
        th.textContent = text;
        th.className = 'p-2 sortable';
        th.dataset.index = columnIndices[idx];
        if (sortConfigPlacar.column === columnIndices[idx]) {
            th.classList.add(sortConfigPlacar.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
        th.addEventListener('click', () => {
            const newDirection = sortConfigPlacar.column === columnIndices[idx] && sortConfigPlacar.direction === 'asc' ? 'desc' : 'asc';
            sortConfigPlacar.column = columnIndices[idx];
            sortConfigPlacar.direction = newDirection;
            const sortedData = sortData(filteredData, columnIndices[idx], newDirection);
            displayData(data, sortedData, page);
            console.log(`Ordenando por coluna ${text} (${columnIndices[idx]}) em ${newDirection}`);
        });
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    if (filteredData.length === 0) {
        showError('Nenhum jogo encontrado com os filtros aplicados.');
    }
    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        columnIndices.forEach(idx => {
            const td = document.createElement('td');
            td.textContent = idx === 2 ? formatTime(row[idx]) : row[idx] || '';
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
    const filters = { time: document.getElementById('time-classification')?.value || '' };
    const filteredData = filterDataClassification(allDataClassification, filters);
    const trHead = document.createElement('tr');
    trHead.className = 'bg-gray-200';
    const headers = ['Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Próprio', 'Gols Contra', 'Saldo', 'Aproveitamento'];
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.className = 'p-2';
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    if (filteredData.length === 0) {
        showError('Nenhum time encontrado com os filtros aplicados.');
    }
    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        row.slice(1).forEach(cell => {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let filteredRows = data.slice(1).filter((row, index) => {
        if (!row || row.length < 18) {
            console.log(`Linha ${index + 2} inválida:`, row);
            return false;
        }
        const dataStr = row[1];
        let dataJogo = null;
        try {
            if (dataStr) {
                if (dataStr.includes('/')) {
                    const [day, month, year] = dataStr.split('/');
                    if (day && month && year && year.length === 4) {
                        dataJogo = new Date(`${year}-${month}-${day}`);
                    }
                } else {
                    dataJogo = new Date(dataStr);
                }
                if (isNaN(dataJogo.getTime())) {
                    console.log(`Data inválida na linha ${index + 2}:`, dataStr);
                    return false;
                }
                dataJogo.setHours(0, 0, 0, 0);
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
        return (
            (!dataInicio || (dataJogo && dataJogo >= dataInicio)) &&
            (!dataFim || (dataJogo && dataJogo <= dataFim)) &&
            (!time || row[4] === time || row[7] === time)
        );
    }).sort((a, b) => (parseInt(a[17]) || 0) - (parseInt(b[17]) || 0));
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
        return !time || row[2] === time;
    }).sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0));
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
        return (!clube || row[2] === clube) && (!jogador || row[1] === jogador);
    }).sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0));
    console.log('Dados filtrados e ordenados por Index:', filteredRows);
    return filteredRows;
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
    const filteredData = filterDataArtilharia(allDataArtilharia, filters);
    const trHead = document.createElement('tr');
    trHead.className = 'bg-gray-200';
    const headers = ['#', 'Jogador', 'Clube', 'Gols'];
    headers.forEach(text => {
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

function displayEstatisticas() {
    console.log('Exibindo dados da Estatísticas');
    clearError();
    const canvasEstatisticas = document.getElementById('estatisticasChart');
    if (!checkElement(canvasEstatisticas, '#estatisticasChart')) {
        showError('Erro interno: canvas do gráfico não encontrado.');
        return;
    }
    if (typeof Chart === 'undefined') {
        showError('Erro ao carregar o gráfico: Chart.js não está disponível.');
        return;
    }
    const filters = {
        clube: document.getElementById('clube-estatisticas')?.value || '',
        jogador: document.getElementById('jogador-estatisticas')?.value || ''
    };
    const filteredDataArtilharia = filterDataArtilharia(allDataArtilharia, filters);
    console.log('Dados filtrados de artilharia:', filteredDataArtilharia);
    if (filteredDataArtilharia.length <= 1) {
        showError('Nenhum dado de artilharia disponível para os filtros selecionados.');
        return;
    }
    const golsPorTime = {};
    filteredDataArtilharia.forEach(row => {
        const time = row[2];
        const gols = parseInt(row[3]) || 0;
        if (time) golsPorTime[time] = (golsPorTime[time] || 0) + gols;
    });
    console.log('Gols por time:', golsPorTime);
    if (Object.keys(golsPorTime).length === 0) {
        showError('Nenhum gol registrado para os times selecionados.');
        return;
    }
    const golsTomados = {};
    allDataSheet1.slice(1).forEach(row => {
        const mandante = row[4];
        const visitante = row[7];
        const placar1 = parseInt(row[5]) || 0;
        const placar2 = parseInt(row[6]) || 0;
        if (mandante) golsTomados[mandante] = (golsTomados[mandante] || 0) + placar2;
        if (visitante) golsTomados[visitante] = (golsTomados[visitante] || 0) + placar1;
    });
    console.log('Gols tomados por time:', golsTomados);
    if (filters.clube) {
        Object.keys(golsTomados).forEach(team => {
            if (team !== filters.clube) delete golsTomados[team];
        });
        Object.keys(golsPorTime).forEach(team => {
            if (team !== filters.clube) delete golsPorTime[team];
        });
    }
    const posicaoMap = {};
    allDataClassification.slice(1).forEach(row => {
        const posicao = row[1]?.replace('º', '') || '999';
        posicaoMap[normalizeString(row[2])] = posicao;
    });
    console.log('Mapa de posições:', posicaoMap);
    if (Object.keys(posicaoMap).length === 0) {
        showError('Nenhum dado de classificação disponível.');
        return;
    }
    let sortedTeams = [];
    if (sortConfigEstatisticas.mode === 'gols') {
        sortedTeams = Object.entries(golsPorTime).sort((a, b) => {
            const golsA = parseInt(a[1]) || 0;
            const golsB = parseInt(b[1]) || 0;
            return golsB - golsA;
        });
    } else if (sortConfigEstatisticas.mode === 'classificacao') {
        sortedTeams = Object.entries(golsPorTime).sort((a, b) => {
            const posA = parseInt(posicaoMap[normalizeString(a[0])] || '999');
            const posB = parseInt(posicaoMap[normalizeString(b[0])] || '999');
            return posA - posB;
        });
    }
    console.log('Times ordenados:', sortedTeams);
    const labels = sortedTeams.map(([team]) => {
        const posicao = posicaoMap[normalizeString(team)] || 'N/A';
        return `${team} (${posicao}º)`;
    });
    const dataGols = sortedTeams.map(([_, gols]) => parseInt(gols) || 0);
    const dataTomados = sortedTeams.map(([team]) => golsTomados[team] || 0);
    console.log('Labels do gráfico:', labels);
    console.log('Dados de gols:', dataGols);
    console.log('Dados de gols tomados:', dataTomados);
    if (estatisticasChart) estatisticasChart.destroy();
    estatisticasChart = new Chart(canvasEstatisticas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gols Feitos',
                    data: dataGols,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#1d4ed8',
                    borderWidth: 1,
                    barThickness: 10,
                    order: 2
                },
                {
                    label: 'Gols Tomados',
                    data: dataTomados,
                    backgroundColor: 'rgba(100, 100, 100, 0.9)',
                    borderColor: '#6B7280',
                    borderWidth: 1,
                    barThickness: 5,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { bottom: 20, right: 10, left: 10, top: 20 }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: false,
                        text: 'Quantidade de Gols',
                        font: { size: window.innerWidth <= 768 ? 10 : 12 }
                    },
                    ticks: { stepSize: 1, font: { size: window.innerWidth <= 768 ? 6 : 8 } }
                },
                x: {
                    title: {
                        display: false,
                        text: 'Times',
                        font: { size: window.innerWidth <= 768 ? 10 : 12 }
                    },
                    ticks: {
                        rotation: 90,
                        autoSkip: false,
                        font: { size: window.innerWidth <= 768 ? 6 : 8 },
                        padding: 5,
                        maxRotation: 90,
                        minRotation: 90
                    },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: window.innerWidth <= 768 ? 8 : 10 } }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: window.innerWidth <= 768 ? 10 : 12 },
                    bodyFont: { size: window.innerWidth <= 768 ? 8 : 10 }
                }
            },
            barPercentage: 0.6,
            categoryPercentage: 0.6
        },
        plugins: [
            overlapBars,
            {
                id: 'customDatalabels',
                afterDraw: (chart) => {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        if (dataset.type !== 'bar') return;
                        const meta = chart.getDatasetMeta(datasetIndex);
                        meta.data.forEach((bar, index) => {
                            const value = dataset.data[index];
                            if (value > 0) {
                                const x = bar.x;
                                const y = bar.y - 10;
                                ctx.save();
                                ctx.textAlign = 'center';
                                ctx.font = `bold ${window.innerWidth <= 768 ? 6 : 8}px Arial`;
                                ctx.fillStyle = '#000';
                                ctx.fillText(value, x, y);
                                ctx.restore();
                            }
                        });
                    });
                }
            }
        ]
    });
    if (labels.length === 0) {
        showError('Nenhum dado disponível para o gráfico.');
    }
}

function displayPlacar() {
    const filters = {
        dataInicio: document.getElementById('dataInicio-placar')?.value || '',
        dataFim: document.getElementById('dataFim-placar')?.value || '',
        time: document.getElementById('time-placar')?.value || ''
    };
    filteredDataPlacar = filterDataSheet1(allDataSheet1, filters);
    if (sortConfigPlacar.column === null || sortConfigPlacar.column === 18) {
        sortConfigPlacar.column = 18;
        sortConfigPlacar.direction = 'asc';
    }
    const sortedData = sortData(filteredDataPlacar, sortConfigPlacar.column, sortConfigPlacar.direction);
    displayData(allDataSheet1, sortedData, 'placar');
}

function clearFilters(tabId) {
    if (tabId === 'placar') {
        ['dataInicio-placar', 'dataFim-placar', 'time-placar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        displayPlacar();
    } else if (tabId === 'classification') {
        ['time-classification'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        displayClassification();
    } else if (tabId === 'artilharia') {
        ['clube-artilharia', 'jogador-artilharia'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        displayArtilharia();
    } else if (tabId === 'estatisticas') {
        ['clube-estatisticas', 'jogador-estatisticas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        sortConfigEstatisticas.mode = 'classificacao'; // Reset para ordenação padrão
        displayEstatisticas();
    } else if (tabId === 'estatisticas2') {
        ['clube-estatisticas2'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        sortConfigEstatisticas2.mode = 'classificacao'; // Reset para ordenação padrão
        displayEstatisticas2();
    }
}

function showTab(tabId) {
    console.log(`Trocando para aba ${tabId}`);
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));
    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    const activeButton = document.getElementById(`${tabId}-btn`);
    if (activeButton) activeButton.classList.add('active-tab');
    if (tabId === 'classification') displayClassification();
    else if (tabId === 'placar') displayPlacar();
    else if (tabId === 'artilharia') displayArtilharia();
    else if (tabId === 'estatisticas') displayEstatisticas();
    else if (tabId === 'estatisticas2') displayEstatisticas2();
}

function displayEstatisticas2() {
    console.log('Exibindo dados da Estatísticas 2');
    clearError();
    const canvasEstatisticas2 = document.getElementById('meuGrafico');
    if (!checkElement(canvasEstatisticas2, '#meuGrafico')) {
        showError('Erro interno: canvas do gráfico não encontrado.');
        return;
    }
    if (typeof Chart === 'undefined') {
        showError('Erro ao carregar o gráfico: Chart.js não está disponível.');
        return;
    }
    const filters = {
        clube: document.getElementById('clube-estatisticas2')?.value || ''
    };
    const filteredDataArtilharia = filterDataArtilharia(allDataArtilharia, filters);
    console.log('Dados filtrados de artilharia (Estatísticas 2):', filteredDataArtilharia);
    if (filteredDataArtilharia.length <= 1) {
        showError('Nenhum dado de artilharia disponível para os filtros selecionados.');
        return;
    }
    const golsPorTime = {};
    filteredDataArtilharia.forEach(row => {
        const time = row[2];
        const gols = parseInt(row[3]) || 0;
        if (time) golsPorTime[time] = (golsPorTime[time] || 0) + gols;
    });
    console.log('Gols por time (Estatísticas 2):', golsPorTime);
    if (Object.keys(golsPorTime).length === 0) {
        showError('Nenhum gol registrado para os times selecionados.');
        return;
    }
    const golsTomados = {};
    allDataSheet1.slice(1).forEach(row => {
        const mandante = row[4];
        const visitante = row[7];
        const placar1 = parseInt(row[5]) || 0;
        const placar2 = parseInt(row[6]) || 0;
        if (mandante) golsTomados[mandante] = (golsTomados[mandante] || 0) + placar2;
        if (visitante) golsTomados[visitante] = (golsTomados[visitante] || 0) + placar1;
    });
    console.log('Gols tomados por time (Estatísticas 2):', golsTomados);
    if (filters.clube) {
        Object.keys(golsTomados).forEach(team => {
            if (team !== filters.clube) delete golsTomados[team];
        });
        Object.keys(golsPorTime).forEach(team => {
            if (team !== filters.clube) delete golsPorTime[team];
        });
    }
    const posicaoMap = {};
    allDataClassification.slice(1).forEach(row => {
        const posicao = row[1]?.replace('º', '') || '999';
        posicaoMap[normalizeString(row[2])] = posicao;
    });
    console.log('Mapa de posições (Estatísticas 2):', posicaoMap);
    if (Object.keys(posicaoMap).length === 0) {
        showError('Nenhum dado de classificação disponível.');
        return;
    }
    let sortedTeams = [];
    if (sortConfigEstatisticas2.mode === 'gols') {
        sortedTeams = Object.entries(golsPorTime).sort((a, b) => {
            const golsA = parseInt(a[1]) || 0;
            const golsB = parseInt(b[1]) || 0;
            return golsB - golsA;
        });
    } else if (sortConfigEstatisticas2.mode === 'classificacao') {
        sortedTeams = Object.entries(golsPorTime).sort((a, b) => {
            const posA = parseInt(posicaoMap[normalizeString(a[0])] || '999');
            const posB = parseInt(posicaoMap[normalizeString(b[0])] || '999');
            return posA - posB;
        });
    }
    console.log('Times ordenados (Estatísticas 2):', sortedTeams);
    const labels = sortedTeams.map(([team]) => {
        const posicao = posicaoMap[normalizeString(team)] || 'N/A';
        return `${team} (${posicao}º)`;
    });
    const dataGols = sortedTeams.map(([_, gols]) => parseInt(gols) || 0);
    const dataTomados = sortedTeams.map(([team]) => golsTomados[team] || 0);
    console.log('Labels do gráfico (Estatísticas 2):', labels);
    console.log('Dados de gols (Estatísticas 2):', dataGols);
    console.log('Dados de gols tomados (Estatísticas 2):', dataTomados);
    if (golsPorTimeChart2) golsPorTimeChart2.destroy();
    golsPorTimeChart2 = new Chart(canvasEstatisticas2, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gols Feitos',
                    data: dataGols,
                    backgroundColor: 'rgba(54, 162, 235, 0.4)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    barThickness: 40,
                    order: 2
                },
                {
                    label: 'Gols Tomados',
                    data: dataTomados,
                    backgroundColor: 'rgba(255, 99, 132, 0.8)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    barThickness: 20,
                    order: 1
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: false, text: 'Quantidade de Gols', font: { size: 14, weight: 'bold' } },
                    ticks: { stepSize: 1, font: { size: 10 } }
                },
                x: {
                    title: { display: false, text: 'Times', font: { size: 14, weight: 'bold' } },
                    ticks: { rotation: 90, autoSkip: false, font: { size: 10 }, padding: 5, maxRotation: 90, minRotation: 90 },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { size: 12 }, padding: 20 } },
                tooltip: { enabled: true, mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 14 }, bodyFont: { size: 12 } }
            },
            responsive: true,
            maintainAspectRatio: false,
            barPercentage: 0.6,
            categoryPercentage: 0.6
        },
        plugins: [overlapBars]
    });
    if (labels.length === 0) {
        showError('Nenhum dado disponível para o gráfico.');
    }
}

async function init() {
    console.log('Inicializando aplicação');
    timesApelidos = await fetchTimesApelidos();
    allDataSheet1 = await fetchFirebaseData('jogos');
    allDataClassification = await fetchFirebaseData('classificacao');
    allDataArtilharia = await fetchFirebaseData('artilharia');
    if (allDataSheet1.length <= 1) showError('Nenhum dado disponível no nó jogos.');
    if (allDataClassification.length <= 1) showError('Nenhum dado disponível no nó classificacao.');
    if (allDataArtilharia.length <= 1) showError('Nenhum dado disponível no nó artilharia.');
    populateFilters();
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.id.replace('-btn', '')));
    });
    document.querySelectorAll('.toggle-filters').forEach(btn => {
        btn.addEventListener('click', () => {
            const filterContent = btn.nextElementSibling;
            filterContent.classList.toggle('hidden');
            btn.textContent = filterContent.classList.contains('hidden') ? 'Abrir Filtros' : 'Fechar Filtros';
        });
    });
    document.getElementById('aplicarFiltros-placar').addEventListener('click', displayPlacar);
    document.getElementById('limparFiltros-placar').addEventListener('click', () => clearFilters('placar'));
    document.getElementById('aplicarFiltros-classification').addEventListener('click', displayClassification);
    document.getElementById('limparFiltros-classification').addEventListener('click', () => clearFilters('classification'));
    document.getElementById('aplicarFiltros-artilharia').addEventListener('click', displayArtilharia);
    document.getElementById('limparFiltros-artilharia').addEventListener('click', () => clearFilters('artilharia'));
    document.getElementById('aplicarFiltros-estatisticas').addEventListener('click', displayEstatisticas);
    document.getElementById('limparFiltros-estatisticas').addEventListener('click', () => clearFilters('estatisticas'));
    document.getElementById('aplicarFiltros-estatisticas2').addEventListener('click', displayEstatisticas2);
    document.getElementById('limparFiltros-estatisticas2').addEventListener('click', () => clearFilters('estatisticas2'));
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
        try {
            await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registrado');
        } catch (error) {
            console.error('Erro ao registrar Service Worker:', error);
        }
    }
    showTab('placar');
}

document.addEventListener('DOMContentLoaded', init);
