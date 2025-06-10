import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const colorsByDifficulty = {
  random: {
    background: "rgba(138, 43, 226, 0.2)", // BlueViolet claro
    border: "rgba(138, 43, 226, 1)",
    point: "rgba(138, 43, 226, 1)",
  },
  easy: {
    background: "rgba(34, 139, 34, 0.2)",  // ForestGreen claro
    border: "rgba(34, 139, 34, 1)",
    point: "rgba(34, 139, 34, 1)",
  },
  hard: {
    background: "rgba(220, 20, 60, 0.2)",  // Crimson claro
    border: "rgba(220, 20, 60, 1)",
    point: "rgba(220, 20, 60, 1)",
  },
};
const alternatingBackgrounds = [
  "rgba(138, 43, 226, 0.2)",  // BlueViolet claro
  "rgba(34, 139, 34, 0.2)",   // ForestGreen claro
  "rgba(220, 20, 60, 0.2)",   // Crimson claro
  "rgba(255, 165, 0, 0.2)",   // Orange claro
  "rgba(70, 130, 180, 0.2)",  // SteelBlue claro
  "rgba(255, 105, 180, 0.2)", // HotPink claro
];

const alternatingBorders = [

  "rgb(31, 26, 26)",
];







async function getScores() {
  const snapshot = await get(ref(db, "scores"));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([key, value]) => ({
    ...value,
    key,
  }));
}


// Función para mezclar un array (Fisher-Yates shuffle)
function shuffleArray(array) {
  const arr = array.slice(); // hacemos una copia para no modificar el original
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createChart(canvasId, title, labels, data, colors) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  // Mezclamos colores antes de asignar
  const shuffledBackgrounds = shuffleArray(alternatingBackgrounds);
  const shuffledBorders = shuffleArray(alternatingBorders);

  const backgroundColors = [];
  const borderColors = [];

  for (let i = 0; i < data.length; i++) {
    backgroundColors.push(shuffledBackgrounds[i % shuffledBackgrounds.length]);
    borderColors.push(shuffledBorders[i % shuffledBorders.length]);
  }

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: title,
        data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}





getScores().then(scores => {
  const difficulties = ["random", "easy", "hard"];

  difficulties.forEach(difficulty => {
    // Filtramos los scores por dificultad
    const filtered = scores.filter(s => (s.difficulty || "").toLowerCase() === difficulty);

    if (filtered.length === 0) {
      // Si no hay datos, limpiamos título y gráfico
      document.getElementById(`title-${difficulty}`).textContent = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} (Sin datos)`;
      return;
    }

    // Calculamos stats: mejor jugador, promedio bosses derrotados
    const bestByPlayer = {};
    let totalDefeated = 0;

    filtered.forEach(s => {
      const playerName = s.playerName || "Anónimo";
      const bossesArr = Array.isArray(s.bosses)
        ? s.bosses
        : typeof s.bosses === "string"
          ? s.bosses.split(",").map(b => b.trim())
          : [];

      const defeated = 50 - bossesArr.length;
      totalDefeated += defeated;

      if (!bestByPlayer[playerName] || defeated > bestByPlayer[playerName]) {
        bestByPlayer[playerName] = defeated;
      }
    });

    const labels = Object.keys(bestByPlayer);
    const data = labels.map(name => bestByPlayer[name]);

    // Mejor jugador y promedio
    const maxDefeated = Math.max(...data);
    const indexMax = data.indexOf(maxDefeated);
    const bestPlayer = labels[indexMax];
    const average = (totalDefeated / filtered.length).toFixed(2);

    // Actualizamos título con info extra
    const titleText = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} — Promedio: ${average}, Mejor: ${bestPlayer} (${maxDefeated})`;
    document.getElementById(`title-${difficulty}`).textContent = titleText;

    // Creamos el gráfico
    createChart(`chart-${difficulty}`, "Bosses derrotados", labels, data, colorsByDifficulty[difficulty]);

  });

  // ---- Gráfico de habilidades ----
  // Contamos la frecuencia total de cada skill en todos los registros
  const skillCounts = {};

  scores.forEach(s => {
    const skillsArr = Array.isArray(s.skills)
      ? s.skills
      : typeof s.skills === "string"
        ? s.skills.split(",").map(skill => skill.trim())
        : [];

    skillsArr.forEach(skill => {
      if (!skill) return;
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
  });

  const skillEntries = Object.entries(skillCounts);
  skillEntries.sort((a, b) => b[1] - a[1]);

  const skillLabels = skillEntries.map(([skill]) => skill);
  const skillData = skillEntries.map(([, count]) => count);

  if (skillLabels.length === 0) {
    document.getElementById("title-skills").textContent = "Uso de Habilidades (Sin datos)";
  } else {
    createChart("chart-skills", "Cantidad de uso de habilidades", skillLabels, skillData, colorsByDifficulty.random);

  }


  // 5to grafico

  const statKeys = ["vida", "ataqueMelee", "ataqueRango", "defensa", "velocidad", "regenVida", "regenMana"];

  // Calculamos promedios de stats por dificultad
  const statsByDifficulty = {
    random: { count: 0 },
    easy: { count: 0 },
    hard: { count: 0 },
  };

  for (const diff of Object.keys(statsByDifficulty)) {
    statKeys.forEach(stat => {
      statsByDifficulty[diff][stat] = 0;
    });
  }

  scores.forEach(s => {
    const diff = (s.difficulty || "").toLowerCase();
    if (!statsByDifficulty[diff]) return; // ignorar otros valores

    if (s.values) {
      statsByDifficulty[diff].count++;
      statKeys.forEach(stat => {
        statsByDifficulty[diff][stat] += Number(s.values[stat]) || 0;
      });
    }
  });

  // Ahora calculamos el promedio
  for (const diff of Object.keys(statsByDifficulty)) {
    if (statsByDifficulty[diff].count === 0) continue;
    statKeys.forEach(stat => {
      statsByDifficulty[diff][stat] /= statsByDifficulty[diff].count;
    });
  }




  // Calculamos porcentajes para cada dificultad
  const percentageDatasets = Object.entries(statsByDifficulty).map(([diff, data]) => {
    if (data.count === 0) return null;

    // Sumar valores de todos los stats para esta dificultad
    const total = statKeys.reduce((sum, stat) => sum + (data[stat] || 0), 0);
    if (total === 0) return null; // evitar división por cero

    // Calcular % por stat
    const percentages = statKeys.map(stat => ((data[stat] || 0) / total) * 100);

    return {
      label: diff.charAt(0).toUpperCase() + diff.slice(1),
      data: percentages,
      fill: true,
      backgroundColor: colorsByDifficulty[diff].background,
      borderColor: colorsByDifficulty[diff].border,
      pointBackgroundColor: colorsByDifficulty[diff].point,

      borderWidth: 2,
    };
  }).filter(Boolean);

  // Mostrar mensaje si no hay datos
  if (percentageDatasets.length === 0) {
    document.getElementById("title-stats-percent").textContent = "Distribución % de Stats (Sin datos)";
  } else {
    const ctxPercent = document.getElementById("chart-stats-percent").getContext("2d");
    new Chart(ctxPercent, {
      type: "radar",
      data: {
        labels: statKeys,
        datasets: percentageDatasets,
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 10 }
          }
        },
        plugins: {
          title: {
            display: true,
            text: "Distribución porcentual de Stats por Dificultad"
          }
        }
      }
    });
  }
















  // Creamos datasets para radar chart
  const radarDatasets = Object.entries(statsByDifficulty).map(([diff, data]) => {
    if (data.count === 0) return null; // omitimos si no hay datos
    return {
      label: diff.charAt(0).toUpperCase() + diff.slice(1),
      data: statKeys.map(stat => data[stat]),
      fill: true,
      backgroundColor: colorsByDifficulty[diff].background,
      borderColor: colorsByDifficulty[diff].border,
      pointBackgroundColor: colorsByDifficulty[diff].point,

      borderWidth: 2,
    };
  }).filter(Boolean);


  // Si no hay datasets, ponemos mensaje en el título
  if (radarDatasets.length === 0) {
    document.getElementById("title-stats").textContent = "Stats Promedio por Dificultad (Sin datos)";
  } else {
    const ctxStats = document.getElementById("chart-stats").getContext("2d");
    new Chart(ctxStats, {
      type: "radar",
      data: {
        labels: statKeys,
        datasets: radarDatasets,
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: {
              stepSize: 10
            }
          }
        }
      }
    });
  }




  // ---- Gráfico de Boss más difícil (el primero en la lista) ----
  const firstBossCounts = {};

  scores.forEach(s => {
    const bossesArr = Array.isArray(s.bosses)
      ? s.bosses
      : typeof s.bosses === "string"
        ? s.bosses.split(",").map(b => b.trim())
        : [];

    const firstBoss = bossesArr[0];
    if (!firstBoss) return;

    firstBossCounts[firstBoss] = (firstBossCounts[firstBoss] || 0) + 1;
  });

  const firstBossEntries = Object.entries(firstBossCounts);
  firstBossEntries.sort((a, b) => b[1] - a[1]);

  const firstBossLabels = firstBossEntries.map(([boss]) => boss);
  const firstBossData = firstBossEntries.map(([, count]) => count);

  if (firstBossLabels.length === 0) {
    document.getElementById("title-first-boss").textContent = "Boss más difícil (Sin datos)";
  } else {
    createChart("chart-first-boss", "Boss con el que perdiste", firstBossLabels, firstBossData, colorsByDifficulty.hard);
  }

  // --- Buscador por jugador ---
document.getElementById("btn-search").addEventListener("click", () => {
  const nameInput = document.getElementById("search-player").value.trim().toLowerCase();
  const resultTitle = document.getElementById("player-result-title");
  const canvas = document.getElementById("chart-player-values");
  const ctx = canvas.getContext("2d");

  if (!nameInput) {
    resultTitle.textContent = "Ingresa un nombre válido.";
    return;
  }

  // Filtrar registros que coincidan con el nombre del jugador
  const playerRecords = scores.filter(s => (s.playerName || "").toLowerCase() === nameInput);

  if (playerRecords.length === 0) {
    resultTitle.textContent = `No se encontraron registros para "${nameInput}".`;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // limpiar canvas
    return;
  }

  // Verificamos en qué dificultades participó
  const difficultiesPlayed = [...new Set(playerRecords.map(s => s.difficulty || "desconocido"))];

  // Tomamos el promedio de sus valores (values)
  const statKeys = ["vida", "ataqueMelee", "ataqueRango", "defensa", "velocidad", "regenVida", "regenMana"];
  const totalStats = {};
  statKeys.forEach(stat => totalStats[stat] = 0);
  let count = 0;

  playerRecords.forEach(s => {
    if (s.values) {
      statKeys.forEach(stat => {
        totalStats[stat] += Number(s.values[stat]) || 0;
      });
      count++;
    }
  });

  if (count === 0) {
    resultTitle.textContent = `Jugador "${nameInput}" encontrado, pero sin valores registrados.`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Calcular promedio
  statKeys.forEach(stat => {
    totalStats[stat] /= count;
  });

  // Calcular distribución en porcentaje
  const totalSum = statKeys.reduce((sum, stat) => sum + totalStats[stat], 0);
  const percentages = statKeys.map(stat => ((totalStats[stat] / totalSum) * 100).toFixed(2));

  resultTitle.textContent = `Jugador "${nameInput}" — Dificultades jugadas: ${difficultiesPlayed.join(", ")}`;

  // Crear gráfico tipo radar
  new Chart(ctx, {
    type: "radar",
    data: {
      labels: statKeys,
      datasets: [{
        label: `Distribución % de stats`,
        data: percentages,
        backgroundColor: "rgba(0, 191, 255, 0.2)", // DeepSkyBlue claro
        borderColor: "rgba(0, 191, 255, 1)",
        pointBackgroundColor: "rgba(0, 191, 255, 1)",
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 10,
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: "Distribución porcentual de stats del jugador"
        }
      }
    }
  });
});




});
