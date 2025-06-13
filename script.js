console.log('Script.js iniciado');

const FIREBASE_URL = 'https://fpfs2025sub9-default-rtdb.firebaseio.com/';
const CACHE_DURATION = 3600000; // 1 hora em milissegundos
let allDataSheet1 = []; // Dados do nó jogos (Placar)
let allDataClassification = []; // Dados do nó classificacao
let filteredDataPlacar = []; // Placar
let sortConfigPlacar = { column: 18, direction: 'asc' }; // Default to Index column
let allDataArtilharia = []; // Dados do nó artilharia
let golsPorTimeChart = null; // Referência ao gráfico Chart.js
let golsTomadosChart = null; // Referência ao gráfico de gols tomados
let timesApelidos = {}; // Mapa de times/clubes para apelidos

// ALTERAÇÃO: Função para formatar strings em Title Case
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
            const headers = ['Index', 'Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Pró', 'Gols Contra', 'Saldo', 'Aproveitamento'];
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
        { id: 'jogador', indices: [1], tab: 'estatisticas' }
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
        return direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueB);
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
            th.classList.add(sortConfigPlacar.direction === 'asc' ? 'asc-' : 'desc-asc');
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
    const headers = ['Posição', 'Time', 'Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols Pró', 'Gols Contra', 'Saldo', 'Aproveitamento'];
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
    const today = new Date('2025-06-13');
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
    const canvasGols = document.getElementById('golsChart');
    if (!checkElement(canvasGols, '#golsChart')) {
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
    const golsPorTime = {};
    filteredDataArtilharia.forEach(row => {
        const time = row[2];
        const gols = parseInt(row[3]) || 0;
        if (time) golsPorTime[time] = (golsPorTime[time] || 0) + gols;
    });
    const golsTomados = {};
    allDataSheet1.slice(1).forEach(row => {
        const mandante = row[4];
        const visitante = row[7];
        const placar1 = parseInt(row[5]) || 0;
        const placar2 = parseInt(row[6]) || 0;
        if (mandante) golsTomados[mandante] = (golsTomados[mandante] || 0) + placar2;
        if (visitante) golsTomados[visitante] = (golsTomados[visitante] || 0) + placar1;
    });
    if (filters.clube) {
        Object.keys(golsTomados).forEach(team => {
            if (team !== filters.clube) delete golsTomados[team];
        });
        Object.keys(golsPorTime).forEach(team => {
            if (team !== filters.clube) delete golsPorTime[team];
        });
    }
    const sortedTeamsGols = Object.entries(golsPorTime).sort((a, b) => b[1] - a[1]);
    const labels = sortedTeamsGols.map(([team]) => team);
    const dataGols = sortedTeamsGols.map(([_, gols]) => gols);
    const dataTomados = labels.map(team => golsTomados[team] || 0);

    if (golsPorTimeChart) golsPorTimeChart.destroy();
    if (golsTomadosChart) golsTomadosChart.destroy();

    golsPorTimeChart = new Chart(canvasGols, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gols Feitos',
                    data: dataGols,
                    backgroundColor: '#3b82f6',
                    borderColor: '#1d4ed8',
                    borderWidth: 1
                },
                {
                    label: 'Gols Tomados',
                    data: dataTomados,
                    backgroundColor: '#ef4444',
                    borderColor: '#b91c1c',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { bottom: 80 } },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: false },
                    ticks: { stepSize: 1 }
                },
                x: {
                    title: { display: false },
                    ticks: { 
                        rotation: 90, 
                        autoSkip: false, 
                        font: { size: 10 }, 
                        padding: 10, 
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
                    labels: { font: { size: 12 } }
                },
                title: { 
                    display: true, 
                    text: 'Gols Feitos e Tomados por Time',
                    font: { size: 16 }
                }
            }
        },
        plugins: [{
            id: 'customDatalabels',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    meta.data.forEach((bar, index) => {
                        const value = dataset.data[index];
                        if (value > 0) {
                            const x = bar.x;
                            const y = bar.y - 10;
                            ctx.save();
                            ctx.textAlign = 'center';
                            ctx.font = '10px Arial';
                            ctx.fillStyle = '#000';
                            ctx.fillText(value, x, y);
                            ctx.restore();
                        }
                    });
                });
            }
        }]
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
        displayEstatisticas();
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

document.addEventListener('DOMContentLoaded', () => {
    init();
    const toasts = document.querySelectorAll('div, span, p');
    let messageFound = false;
    toasts.forEach(el => {
        if (el.textContent.includes('Toque para copiar o URL desse app')) {
            el.style.display = 'none';
            messageFound = true;
            console.log('Mensagem "Toque para copiar o URL desse app" ocultada');
        }
    });
    if (!messageFound) {
        console.log('Mensagem "Toque para copiar o URL desse app" não encontrada no DOM');
    }
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.textContent.includes('Toque para copiar o URL desse app')) {
                    node.style.display = 'none';
                    console.log('Mensagem dinâmica "Toque para copiar o URL desse app" ocultada');
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
});