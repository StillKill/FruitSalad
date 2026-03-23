const DEFAULT_FRUITS = ['kiwi', 'orange', 'apple', 'banana', 'lime', 'mango'];

function getFruitCount(fruitCounts, fruit) {
  return fruitCounts?.[fruit] ?? 0;
}

function getTotalFruitCount(fruitCounts) {
  return Object.values(fruitCounts ?? {}).reduce((sum, count) => sum + count, 0);
}

function getTargetFruit(card) {
  return card.saladFruits?.[0];
}

function countQualifiedKinds(fruitCounts, fruits, threshold) {
  return fruits.filter((fruit) => getFruitCount(fruitCounts, fruit) >= threshold).length;
}

function countMissingKinds(fruitCounts, fruits) {
  return fruits.filter((fruit) => getFruitCount(fruitCounts, fruit) === 0).length;
}

function getCompareMetric(card, fruitCounts) {
  switch (card.ruleType) {
    case 'compare-majority':
    case 'compare-minority':
      return getFruitCount(fruitCounts, getTargetFruit(card));
    case 'compare-wealth':
    case 'compare-poverty':
      return getTotalFruitCount(fruitCounts);
    default:
      return 0;
  }
}

function buildCompareBreakdown(card, playerMetric, allMetrics, awardedPoints) {
  return {
    kind: 'compare',
    ruleType: card.ruleType,
    metric: playerMetric,
    contenders: allMetrics,
    awardedPoints
  };
}

function scoreCompareCard(card, fruitCounts, tableSnapshot) {
  const playerMetric = getCompareMetric(card, fruitCounts);
  const allMetrics = tableSnapshot.map((player) => ({
    playerId: player.playerId ?? null,
    playerName: player.playerName ?? null,
    metric: getCompareMetric(card, player.fruitCounts)
  }));

  const orderedMetrics = allMetrics.map((entry) => entry.metric);
  const boundaryMetric =
    card.ruleType === 'compare-majority' || card.ruleType === 'compare-wealth'
      ? Math.max(...orderedMetrics)
      : Math.min(...orderedMetrics);

  const winners = allMetrics.filter((entry) => entry.metric === boundaryMetric);
  const awardedPoints =
    winners.length === 1 && playerMetric === boundaryMetric ? card.scoring.points : 0;

  return {
    points: awardedPoints,
    breakdown: buildCompareBreakdown(card, playerMetric, allMetrics, awardedPoints)
  };
}

function scoreParityCard(card, fruitCounts) {
  const targetFruit = getTargetFruit(card);
  const count = getFruitCount(fruitCounts, targetFruit);

  if (count === 0 && card.scoring.zeroScores === false) {
    return {
      points: 0,
      breakdown: { kind: 'parity', targetFruit, count, parity: 'zero', awardedPoints: 0 }
    };
  }

  const isEven = count % 2 === 0;
  const points = isEven ? card.scoring.evenPoints : card.scoring.oddPoints;

  return {
    points,
    breakdown: {
      kind: 'parity',
      targetFruit,
      count,
      parity: isEven ? 'even' : 'odd',
      awardedPoints: points
    }
  };
}

function scoreThresholdCard(card, fruitCounts, fruits) {
  const qualifiedKinds = countQualifiedKinds(fruitCounts, fruits, card.scoring.threshold);
  const points = qualifiedKinds * card.scoring.pointsPerQualifiedKind;

  return {
    points,
    breakdown: {
      kind: 'threshold',
      threshold: card.scoring.threshold,
      qualifiedKinds,
      awardedPoints: points
    }
  };
}

function scoreMissingKindCard(card, fruitCounts, fruits) {
  const missingKinds = countMissingKinds(fruitCounts, fruits);
  const points = missingKinds * card.scoring.pointsPerMissingKind;

  return {
    points,
    breakdown: { kind: 'missing', missingKinds, awardedPoints: points }
  };
}

function scoreSameKindSetCard(card, fruitCounts) {
  const targetFruit = getTargetFruit(card);
  const count = getFruitCount(fruitCounts, targetFruit);
  const completedSets = Math.floor(count / card.scoring.setSize);
  const points = completedSets * card.scoring.pointsPerSet;

  return {
    points,
    breakdown: {
      kind: 'same-kind-set',
      targetFruit,
      count,
      setSize: card.scoring.setSize,
      completedSets,
      awardedPoints: points
    }
  };
}

function scoreDistinctKindSetCard(card, fruitCounts) {
  const distinctFruits = [...new Set(card.saladFruits)];
  const completedSets = Math.min(...distinctFruits.map((fruit) => getFruitCount(fruitCounts, fruit)));
  const points = completedSets * card.scoring.pointsPerSet;

  return {
    points,
    breakdown: {
      kind: 'distinct-kind-set',
      fruits: distinctFruits,
      setSize: card.scoring.setSize,
      completedSets,
      awardedPoints: points
    }
  };
}

function scorePerFruitFlatCard(card, fruitCounts) {
  const targetFruit = getTargetFruit(card);
  const count = getFruitCount(fruitCounts, targetFruit);
  const points = count * card.scoring.pointsPerFruit;

  return {
    points,
    breakdown: {
      kind: 'per-fruit-flat',
      targetFruit,
      count,
      pointsPerFruit: card.scoring.pointsPerFruit,
      awardedPoints: points
    }
  };
}

function scorePerFruitMultiCard(card, fruitCounts) {
  const contributions = card.saladFruits.map((fruit, index) => {
    const count = getFruitCount(fruitCounts, fruit);
    const pointsPerFruit = card.scoring.points[index] ?? 0;
    const subtotal = count * pointsPerFruit;

    return { fruit, count, pointsPerFruit, subtotal };
  });

  const points = contributions.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    points,
    breakdown: {
      kind: 'per-fruit-multi',
      contributions,
      awardedPoints: points
    }
  };
}

export function scoreSaladCard(card, fruitCounts, tableSnapshot = [], fruits = DEFAULT_FRUITS) {
  switch (card.ruleType) {
    case 'compare-majority':
    case 'compare-minority':
    case 'compare-wealth':
    case 'compare-poverty':
      return scoreCompareCard(card, fruitCounts, tableSnapshot);
    case 'parity-fruit':
      return scoreParityCard(card, fruitCounts);
    case 'threshold-per-kind':
      return scoreThresholdCard(card, fruitCounts, fruits);
    case 'missing-kind':
      return scoreMissingKindCard(card, fruitCounts, fruits);
    case 'set-same-kind':
      return scoreSameKindSetCard(card, fruitCounts);
    case 'set-distinct-kind':
      return scoreDistinctKindSetCard(card, fruitCounts);
    case 'per-fruit-flat':
      return scorePerFruitFlatCard(card, fruitCounts);
    case 'per-fruit-multi':
      return scorePerFruitMultiCard(card, fruitCounts);
    default:
      throw new Error(`Unsupported rule type: ${card.ruleType}`);
  }
}

export function scorePlayerTotal(saladCards, fruitCounts, tableSnapshot = [], fruits = DEFAULT_FRUITS) {
  const cardScores = saladCards.map((card) => {
    const result = scoreSaladCard(card, fruitCounts, tableSnapshot, fruits);

    return {
      cardId: card.id,
      ruleType: card.ruleType,
      points: result.points,
      breakdown: result.breakdown
    };
  });

  return {
    totalPoints: cardScores.reduce((sum, card) => sum + card.points, 0),
    cardScores
  };
}

export function buildTableSnapshot(players) {
  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    fruitCounts: player.fruitCounts
  }));
}