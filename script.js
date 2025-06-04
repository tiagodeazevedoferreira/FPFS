function parseDateStr(dataStr) {
  if (!dataStr || typeof dataStr !== 'string') {
    console.warn('Data inválida ou vazia:', dataStr);
    return null;
  }
  let parts = dataStr.split('/');
  if (parts.length !== 3) {
    console.warn('Formato de data inválido (esperado DD/MM/YYYY):', dataStr);
    return null;
  }
  const [day, month, year] = parts;
  const date = new Date(`${year}-${month}-${day}`);
  if (!isValidDate(date)) {
    console.warn('Data inválida após conversão:', dataStr);
    return null;
  }
  return date;
}

function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

function filterDataSheet1(data, dataInicio, dataFim) {
  let filteredDataPlacar = [];
  if (!data || typeof data !== 'object') {
    console.warn('Dados inválidos para filtragem:', data);
    showError('Erro ao carregar os dados.');
    return filteredDataPlacar;
  }

  Object.keys(data).forEach(key => {
    const row = data[key];
    if (!row || typeof row !== 'object') return;

    const considerar = row['Considerar'] || '';
    const isValidConsiderar = considerar === '1';
    if (!isValidConsiderar) return;

    const dataStr = row['Data'] || '';
    const dataJogo = parseDateStr(dataStr);
    if (!dataJogo) {
      console.warn('Formato de data inválido:', dataStr);
      return;
    }

    if (dataJogo >= dataInicio && dataJogo <= dataFim) {
      filteredDataPlacar.push({
        ...row,
        DataJogo: dataJogo,
        Index: parseInt(row['Index'] || 0) // Garantir que Index seja número
      });
    }
  });

  // Ordenar os dados pelo campo Index em ordem crescente
  filteredDataPlacar.sort((a, b) => a.Index - b.Index);

  console.log('Dados filtrados para Placar:', filteredDataPlacar);
  if (filteredDataPlacar.length === 0) {
    showError('Nenhum jogo encontrado no intervalo de datas selecionado.');
  }

  return filteredDataPlacar;
}

// Exemplo de chamada (ajuste conforme necessário)
function loadPlacarData() {
  const database = firebase.database();
  const jogosRef = database.ref('jogos');
  jogosRef.once('value').then(snapshot => {
    const data = snapshot.val();
    const dataInicio = new Date('2025-01-01'); // Exemplo
    const dataFim = new Date('2025-12-31'); // Exemplo
    const filteredData = filterDataSheet1(data, dataInicio, dataFim);
    // Atualizar a UI com filteredData (implemente conforme necessário)
    updatePlacarUI(filteredData);
  }).catch(error => {
    console.error('Erro ao carregar dados do Firebase:', error);
    showError('Erro ao carregar os dados.');
  });
}

function showError(message) {
  // Implemente conforme necessário (ex.: exibir mensagem no UI)
  console.error(message);
}

function updatePlacarUI(data) {
  // Implemente conforme necessário (ex.: atualizar tabela HTML com os dados)
  console.log('Atualizando UI com dados:', data);
}