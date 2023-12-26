'use strict';

const GUESS_LEN = 5;
const NUM_GUESSES = 7;

var allowedWords = [];
var curRow = 0;
var curBox = 0;
var todaysWords = {R: undefined, L: undefined};
var todaysNum = 0;
var lastCompletedWordNum;
var stats;
var historicDate;
var numStepsToVictory = {R: -1, L: -1};
var globalWinLossStats;
var twoWeekStats;

function niceAlert(text) {
  $('#alert-text').text(text);
  $('#alert').css('opacity', 1).show();
  setTimeout(() => {
    $('#alert').animate({opacity: 0}, {complete: () => $('#alert').hide()});
  }, 2500);
}

function storeState() {
  var curGuesses = [];
  for (var i = 0; i < curRow; ++i) {
    curGuesses.push(getWordAtRow(i));
  }
  var state = {
    lastCompletedWordNum: lastCompletedWordNum,
    stats: stats,
    curGuesses: curGuesses,
    lastStartedWordNum: todaysNum,
  };
  const encodedState = encodeURIComponent(JSON.stringify(state));
  document.cookie = 'state=' + encodedState + ';max-age=' + 60*60*24*365*10;
}

/* Get today's win/loss statistics. Called exactly once on win or loss. */
function getGlobalWinLossStats(hasWon) {
  var guesses = [];
  for (var i = 0; i < curRow; ++i) {
    const row = getWordAtRow(i);
    if (row) {
      guesses.push(getWordAtRow(i));
    }
  }
  const state = {
    guesses: guesses,
    todaysNum: todaysNum
  };
  $.post('final_state', state, (globalStats) => {
    // Build global stats histogram for today.
    const labels = ['2', '3', '4', '5', '6', '7', '∞'];
    const values = labels.map(label => globalStats[label]);
    const highlightColumn = (hasWon ? guesses.length - 2 : 6);
    globalWinLossStats = $('<div class="stats-wrapper">');
    globalWinLossStats.append(
      $('<div class="stats-title">').text('משתמשים אחרים היום'));
    globalWinLossStats.append(buildHistogram(labels, values, 'percent', highlightColumn));
    $('.global-stats').append(globalWinLossStats);
    twoWeekStats = buildTwoWeekStats(globalStats);
    $('.global-stats').append(twoWeekStats);
  });
}

function loadState() {
  const stateCookie = document.cookie
      .split('; ')
      .find(item => item.startsWith('state='));
  var state;
  if (typeof stateCookie == 'undefined') {
    state = {}
  } else {
    const encodedState = stateCookie.substr(6);
    state = JSON.parse(decodeURIComponent(encodedState));
  }
  lastCompletedWordNum = state.lastCompletedWordNum || -1;
  stats = state.stats || [0, 0, 0, 0, 0, 0, 0, 0];
  const lastStartedWordNum = state.lastStartedWordNum || -1;
  if (state.curGuesses && (lastStartedWordNum == todaysNum)) {
    curRow = state.curGuesses.length;
    for (let row = 0; row < curRow; ++row) {
      for (let col = 0; col < GUESS_LEN; ++col) {
        $('#box-R-' + row + '-' + col).text(state.curGuesses[row][col]);
        $('#box-L-' + row + '-' + col).text(state.curGuesses[row][col]);
      }
      ['R', 'L'].forEach(side => {
        if(numStepsToVictory[side] < 0 || numStepsToVictory[side] >= row) {
          scoreGuessAtRow(row, side);
        }
      });
    }
  }
}

function addKeys(rowId, letters) {
  for (var i = 0; i < letters.length; ++i) {
    var key = $('<div class="key">');
    key.attr('value', letters[i]);
    if (letters[i] == ' ') {
      key.addClass('nokey');
    } else {
      var underKey = $('<div class="underkey">');
      underKey.append($('<div class="underkey-R">'))
      underKey.append($('<div class="underkey-L">'))
      key.append(underKey);
      key.append($('<div class="key-softener">'));
      key.append($('<div class="overkey">').text(letters[i]));
    }
    $(rowId).append(key);
  }
}

function addGuessRows() {
  ['R', 'L'].forEach(side => {
    for (var nRow = 0; nRow < NUM_GUESSES; ++nRow) {
      var row = $('<div class="guess-row">');
      for (var nBox = 0; nBox < GUESS_LEN; ++nBox) {
        var box = $('<div class="box">');
        box.attr('id', 'box-'+side+'-'+nRow+'-'+nBox);
        box.addClass('box-col-'+nBox);
        box.addClass('box-row-'+nRow);
        row.append(box);
      }
      $('#guesses-'+side).append(row);
    }
  });
}

function letterKeyPress(key) {
  if (curRow >= NUM_GUESSES) {
    return;
  }
  if (curBox >= GUESS_LEN) {
    return;
  }
  $('#box-R-'+curRow+'-'+curBox).text(key);
  $('#box-L-'+curRow+'-'+curBox).text(key);
  curBox++;
  if (curBox == GUESS_LEN && !isWordAllowed(getWordAtRow(curRow))) {
    $('.box-row-'+curRow).addClass('invalid-word');
  }
}

function backspaceKeyPress() {
  if (curRow >= NUM_GUESSES) {
    return;
  }
  if (curBox == 0) {
    return;
  }
  curBox--;
  $('.box-row-'+curRow).removeClass('invalid-word');
  $('#box-R-'+curRow+'-'+curBox).text('');
  $('#box-L-'+curRow+'-'+curBox).text('');
}

function getWordAtRow(nRow) {
  var word = '';
  for (var i = 0; i < GUESS_LEN; ++i) {
    // It's the same word in both sides, so we arbitrarily take the R side.
    word += $('#box-R-'+nRow+'-'+i).text();
  }
  return word;
}

function scoreGuessAtRow(row, side) {
  var i;
  var todaysLetters = Array.from(todaysWords[side]);
  var curElem;
  var letter;
  // Score buls.
  var nBuls = 0;
  for (var i = 0; i < GUESS_LEN; ++i) {
    curElem = $('#box-'+side+'-'+row+'-'+i);
    letter = curElem.text();
    if (letter == todaysLetters[i]) {
      ++nBuls;
      curElem.addClass('bul-box');
      $('.key[value="'+letter+'"] .underkey-'+side).removeClass('pgia-key').addClass('bul-key');
      todaysLetters[i] = '+';
    }
  }
  if (nBuls == GUESS_LEN) {
    // This word has been correctly guessed.
    numStepsToVictory[side] = row;
    // Make the keyboard colors narrower for this side.
    $('#keyboard').addClass('victory-'+side)
    // Make letter in all remaining rows invisible.
    for (let i = row + 1; i < NUM_GUESSES; ++i) {
      for (let j = 0; j < GUESS_LEN; ++j) {
        $('#box-'+side+'-'+i+'-'+j).addClass('invisible-box');
      }
    }
    return nBuls;
  }

  // Score pgias and klums.
  for (var i = 0; i < GUESS_LEN; ++i) {
    curElem = $('#box-'+side+'-'+row+'-'+i);
    if (curElem.hasClass('bul-box')) {
      continue;
    }
    letter = curElem.text();
    var correctPos = todaysLetters.indexOf(letter);
    if (correctPos > -1) {
      curElem.addClass('pgia-box');
      todaysLetters[correctPos] = '-';
      if (!$('.key[value="'+letter+'"] .underkey-'+side).hasClass('bul-key')) {
        $('.key[value="'+letter+'"] .underkey-'+side).addClass('pgia-key');
      }
    } else {
      curElem.addClass('klum-box');
      if (!$('.key[value="'+letter+'"] .underkey-'+side).hasClass('bul-key') &&
          !$('.key[value="'+letter+'"] .underkey-'+side).hasClass('pgia-key')) {
        $('.key[value="'+letter+'"] .underkey-'+side).addClass('klum-key');
      }
    }
  }

  return nBuls;
}

function isWordAllowed(word) {
  return (allowedWords.includes(word) ||
          word == todaysWords.L ||
          word == todaysWords.R);
}

function enterKeyPress() {
  if (curRow >= NUM_GUESSES) {
    return;
  }
  if (curBox < GUESS_LEN) {
    niceAlert('יש לנחש מילה בת חמש אותיות')
    return;
  }
  if (!isWordAllowed(getWordAtRow(curRow))) {
    niceAlert('מילה לא מוכרת');
    return;
  }
  var nBuls = {};
  ['R', 'L'].forEach(side => {
    if(numStepsToVictory[side] >= 0) {
      // This word was already correctly guessed.
      nBuls[side] = GUESS_LEN;
    } else {
      nBuls[side] = scoreGuessAtRow(curRow, side);
    }
  });
  if (numStepsToVictory.L >= 0 && numStepsToVictory.R >= 0) {
    // Won both sides.
    curBox = 0;
    curRow = NUM_GUESSES;
    if (!historicDate) {
      lastCompletedWordNum = todaysNum;
      ++stats[Math.max(numStepsToVictory.L, numStepsToVictory.R)];
      getGlobalWinLossStats(true);
      storeState();
    }
    setTimeout(showWinModal, 900);
    return;
  }
  if (curRow < NUM_GUESSES - 1) {
    // Move to next row.
    curBox = 0;
    curRow++;
    if (!historicDate) {
      storeState();
    }
    return;
  }
  // Game has completed, at least one word has not been guessed.
  curRow = NUM_GUESSES;
  ['L', 'R'].forEach(side => {
    if (numStepsToVictory[side] == -1) {
      numStepsToVictory[side] = NUM_GUESSES;
    }
  });
  if (!historicDate) {
    lastCompletedWordNum = todaysNum;
    ++stats[Math.max(numStepsToVictory.L, numStepsToVictory.R)];
    getGlobalWinLossStats(false);
    storeState();
  }
  setTimeout(showLossModal, 900);
}

function getEmojiString(side, row) {
  var emojiString = '';
  for (var col = 0; col < GUESS_LEN; ++col) {
    if (row > numStepsToVictory[side]) {
      emojiString += '✔️';
    } else {
      const curBox = $('#box-'+side+'-'+row+'-'+col);
      if (curBox.hasClass('bul-box')) {
        emojiString += '🟩';
      } else if (curBox.hasClass('pgia-box')) {
        emojiString += '🟨';
      } else {
        emojiString += '⬜';
      }
    }
  }
  return emojiString;
}

function getEmojiResult() {
  let result = '';
  for (let row = 0; row < NUM_GUESSES; ++row) {
    result += '\u200F';  // Right-to-left mark
    result += getEmojiString('R', row);
    result += ' ';
    result += getEmojiString('L', row);
    result += '\u200F';  // Right-to-left mark
    result += '\n';
    if (row >= numStepsToVictory.L && row >= numStepsToVictory.R) {
      break;
    }
  }
  return result;
}

function showWinModal() {
  var shareData = {
    url: 'https://milotayim.com',
    title: 'מילותיים',
    text: 'ניצחתי במשחק מילותיים מס\' ' + todaysNum + ':\n',
  };
  shareData.text += getEmojiResult() + '\n';
  var topContents = 
  [
    'חיזרו אלינו מחר למשחק נוסף.',
    'בינתיים, האם ניסיתם את <a target="_blank" href="https://bulmila.com">בול מילה</a>?',
    'יש לכם הצעה לצמד מילים מוצלח? <a target="_blank" href="/suggest.html">שלחו לנו!</a>',
  ];
  var bottomContents = 
  [
    $('<div class="global-stats">'),
  ];
  if (globalWinLossStats) {
    bottomContents[0].append(globalWinLossStats);
  }
  if (twoWeekStats) {
    bottomContents[0].append(twoWeekStats);
  }
  var numTurnsPlayed;
  for (numTurnsPlayed = 0; numTurnsPlayed < curRow; ++numTurnsPlayed) {
    if (!getWordAtRow(numTurnsPlayed)) {
      break;
    }
  }
  showModal(
    'ניצחון!',
    topContents,
    bottomContents,
    shareData,
    numTurnsPlayed - 2);
}

function showLossModal() {
  var shareData = {
    url: 'https://milotayim.com',
    title: 'מילותיים',
    text: 'הפסדתי במשחק מילותיים מס\' ' + todaysNum + ':\n',
  };
  shareData.text += getEmojiResult() + '\n';
  var topContents =
      [
        'המילים הנכונות הן:',
        todaysWords.L,
        todaysWords.R,
        'לא נורא, נסו שוב עם מילה חדשה מחר.'
      ];
  var bottomContents = 
  [
    $('<div class="global-stats">'),
  ];
  if (globalWinLossStats) {
    bottomContents[0].append(globalWinLossStats);
  }
  if (twoWeekStats) {
    bottomContents[0].append(twoWeekStats);
  }
  showModal(
    'הפסדתם :(',
    topContents,
    bottomContents,
    shareData,
    6);
}

function showModal(title, topItems, bottomItems, shareData, statsHighlightedBar) {
  var modalContent = $('<div class="modal-content">');
  var closeButton = $('<div class="modal-close-button">');
  closeButton.text('×');
  closeButton.click(event => {$('.modal').hide();});
  modalContent.append(closeButton);
  modalContent.append($('<div class="modal-title">').text(title));
  for (var i=0; i < topItems.length; ++i) {
    if (typeof topItems[i] === 'string') {
      modalContent.append($('<div class="modal-text">').html(topItems[i]));
    } else {  // Assume this is a jQuery object.
      modalContent.append(topItems[i]);
    }
  }
  modalContent.append(getStatsChart(statsHighlightedBar));
  for (var i=0; i < bottomItems.length; ++i) {
    if (typeof bottomItems[i] === 'string') {
      modalContent.append($('<div class="modal-text">').html(bottomItems[i]));
    } else {  // Assume this is a jQuery object.
      modalContent.append(bottomItems[i]);
    }
  }
  if (typeof shareData != 'undefined') {
    var shareButton = $('<div class="modal-button">');
    shareButton.text('שיתוף');
    shareButton.click(event => {
      if (navigator.canShare && navigator.canShare({text: 'myText'})) {
        navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(shareData.text + shareData.url).then(
          () => { niceAlert('הטקסט הועתק. עברו לאפליקציה אחרת ובחרו "הדבק".'); },
          () => { niceAlert('לא ניתן לשתף בדפדפן זה.')}
        )
      }
    });
    modalContent.append(shareButton);
  }
  var creditsDiv = $('<div class="modal-text-tiny">');
  creditsDiv.text('המשחק מילותיים נכתב על ידי ');
  creditsDiv.append($('<a href="https://zvikabenhaim.appspot.com/" target="_blank">')
      .text('צביקה בן-חיים'));
  modalContent.append(creditsDiv);
  modalContent.on('scroll', (e) => {
    setScrollFadeClasses(e.currentTarget);
  });
  var modal = $('<div class="modal">');
  var modalFrame = $('<div class="modal-frame">');
  modalFrame.append(modalContent);
  modal.append(modalFrame);
  $('body').append(modal);
  setScrollFadeClasses(modalContent[0]);
}

function setScrollFadeClasses(elem) {
  const isScrollable = elem.scrollHeight > elem.clientHeight;
  
  // GUARD: If element is not scrollable, remove all classes.
  if (!isScrollable) {
    elem.classList.remove('modal-fade-top', 'modal-fade-bottom');
    return;
  }

  // Otherwise, the element is overflowing!
  // Now we just need to find out which direction it is overflowing to
  // (might be both).
  const isScrolledToBottom = (
      elem.scrollHeight < elem.clientHeight + elem.scrollTop + 6);
  const isScrolledToTop = (
      isScrolledToBottom ? false : elem.scrollTop === 0);
  elem.classList.toggle('modal-fade-bottom', !isScrolledToBottom);
  elem.classList.toggle('modal-fade-top', !isScrolledToTop);
}

function getStatsChart(statsHighlightedBar) {
  const labels = ['2', '3', '4', '5', '6', '7', '∞'];
  var mean = 0;
  var mean2 = 0;
  var count = 0;
  for (var i = 0; i < stats.length; ++i) {
    mean += (i+1) * stats[i];
    mean2 += (i+1) * (i+1) * stats[i];
    count += stats[i];
  }
  mean /= count;
  mean2 /= count;
  var elem = $('<div class="stats-wrapper">');
  elem.append($('<div class="stats-title">').text('הסטטיסטיקה שלך'));
  var numericStats = $('<div class="stats-numeric">');
  const statsTableData = [
      ['משחקים', count],
      ['ממוצע', mean.toFixed(2)],
  ]
  if (count >= 5) {
    // Compute standard deviation.
    const variance = mean2 - mean*mean;
    const std = Math.sqrt(variance);
    statsTableData.push(['סטיית תקן', std.toFixed(2)]);
    if (count >= 20) {
      // Compute confidence interval.
      const ci_width = 1.96 * Math.sqrt(variance / (count - 1));
      const conf_int = '\u200e[' + (mean - ci_width).toFixed(1) + ', '
                                 + (mean + ci_width).toFixed(1) + ']\u200e';
      statsTableData.push(['רווח סמך 95%', conf_int]);
    }
  }
  for (var i = 0; i < statsTableData.length; ++i) {
    numericStats.append($('<div>')
        .css('grid-row', 1)
        .css('grid-column', i+1)
        .addClass('stats-numeric-header')
        .text(statsTableData[i][0]));
    numericStats.append($('<div>')
        .css('grid-row', 0)
        .css('grid-column', i+1)
        .addClass('stats-numeric-value')
        .text(statsTableData[i][1]));
  }
  elem.append(numericStats);
  elem.append(buildHistogram(labels, stats.slice(1), 'count', statsHighlightedBar));
  return elem;
}

/**
 * Generates an HTML histogram from the given labels and counts.
 * @param {string[]} labels List of labels for each bar
 * @param {int[]} values List of counts for each bar
 * @param {string} textFormat Can be either 'count' (show actual values) or
 *   'percent' (show percentages)
 * @param {int} highlightedBar Index of the bar to highlight, or -1 if no
 *   bar should be highlighted.
 * @returns jQuery element containing the generated histogram.
 */
function buildHistogram(labels, values, textFormat, highlightedBar) {
  var maxVal = Math.max(...values);
  if (maxVal < 1) maxVal = 1;
  var sumVals = values.reduce((accumulator, currentValue) => {
    return accumulator + currentValue
  }, 0);
  if (sumVals < 1) sumVals = 1;
  var table = $('<div class="stats-histogram">');
  for (var i = 0; i < labels.length; ++i) {
    table.append($('<div>')
        .css('grid-row', i+1)
        .css('grid-column', 1)
        .addClass('stats-num-guesses')
        .text(labels[i]));
    var child = $('<div>')
        .css('grid-row', i+1)
        .css('grid-column', 0)
        .addClass('stats-bar-container');
    var bar = $('<div>').addClass('stats-bar');
    const width = Math.ceil(100 * values[i] / maxVal);
    bar.width(width + '%');
    if (i == highlightedBar) {
      bar.addClass('highlighted-bar');
    }
    var text;
    if (textFormat === 'count') {
      text = values[i];
    } else {  // textFormat == 'percent'
      text = (values[i] / sumVals * 100).toFixed(0) + '%'
    }
    bar.append($('<div class="stats-bar-text">').text(text))
    child.append(bar);
    table.append(child);
  }
  return table;
}

function buildTwoWeekStats(globalStats) {
  var div = $('<div class="stats-wrapper">');
  div.append(
    $('<div class="stats-title">').text('השבועיים האחרונים'));
  var twoColumnDiv = $('<div class="two-column-flex">');
  twoColumnDiv.append(buildPieChart(globalStats.easiest_game, 'קל'));
  twoColumnDiv.append(buildPieChart(globalStats.hardest_game, 'קשה'));
  div.append(twoColumnDiv);
  var legend = $('<div class="pie-legend">');
  var addLegendItem = function(color, text) {
    var legendItem = $('<div class="pie-legend-item">');
    legendItem.append($('<div class="pie-legend-colorbox">')
        .css('background-color', color));
    legendItem.append($('<div class="pie-legend-text">').text(text));
    legend.append(legendItem);
  };
  addLegendItem('#4343ff', 'נצחונות');
  addLegendItem('#ff4a4a', 'הפסדים');
  div.append(legend);
  return div;
}

function buildPieChart(stats, difficultyText) {
  var wrapper = $('<div class="pie-wrapper">');
  wrapper.append($('<div class="pie-title">').text(
      'הצמד ה' + difficultyText + ' ביותר'));
  wrapper.append($('<div class="pie-pair">').text(
      stats.words.R + '-' + stats.words.L));
  wrapper.append($('<div class="pie-date">').text(stats.date));
  const pctSuccess = (stats.win_fraction * 100).toFixed(0);
  var pie = $('<div class="pie">');
  pie.css(
    'background-image',
    'conic-gradient(#4343ff ' + pctSuccess + '%, #ff4a4a ' + pctSuccess + '%)');
  const winAngle = pctSuccess / 100 * 2 * Math.PI / 2;
  const loseAngle = winAngle * 2 + (100 - pctSuccess) / 100 * 2 * Math.PI / 2;
  pie.append($('<div class="pie-pct pie-pct-win">')
      .css('left', '' + (50 - 15 + 25 * Math.sin(winAngle)) + 'px')
      .css('top', '' + (50 - 8 - 25 * Math.cos(winAngle)) + 'px')
      .text('' + pctSuccess + '%'));
  pie.append($('<div class="pie-pct pie-pct-loss">')
      .css('left', '' + (50 - 15 + 25 * Math.sin(loseAngle)) + 'px')
      .css('top', '' + (50 - 8 - 25 * Math.cos(loseAngle)) + 'px')
      .text('' + (100 - pctSuccess) + '%'));
  wrapper.append(pie);
  return wrapper;
}

function virtualKeyPress(event) {
  const key = $(event.target).attr('value');
  switch (key) {
    case ' ':
      return;  // one of the spacer keys
    case '⏎':
      enterKeyPress();
      return;
    case '⌦':
      backspaceKeyPress();
      return;
    default:
      letterKeyPress(key);
      return;
  }
}

function keyboardKeyPress(event) {
  if (event.which >= 0x5d0 && event.which <= 0x5ea) {
    // Hebrew character
    var key = String.fromCharCode(event.which);
    const toNonFinal = {'ם': 'מ', 'ך': 'כ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'};
    if (typeof toNonFinal[key] != 'undefined') {
      key = toNonFinal[key];
    }
    letterKeyPress(key);
    return;
  }
  if (event.which == 13) {
    enterKeyPress();
    return;
  }
}

function keyboardKeyDown(event) {
  if (event.which == 8) {
    backspaceKeyPress();
    return;
  }
}

function startGame() {
  $('#instructions').hide();
  $(document).keypress(keyboardKeyPress);
  $(document).keydown(keyboardKeyDown);
  $('.key').click(virtualKeyPress);
}

function getUrlParams() {
  historicDate = new URL(window.location.href).searchParams.get('date');
}

$(document).ready(() => {
  addGuessRows();
  addKeys('#keybd-row1', 'פ  וטארק ');
  addKeys('#keybd-row2', 'לחיעכגדש');
  addKeys('#keybd-row3', '⏎תצמנהבסז⌦');
  getUrlParams();
  $('.modal-content')[0].addEventListener('scroll', (e) => {
    setScrollFadeClasses(e.currentTarget);
  });
  setScrollFadeClasses($('.modal-content')[0]);
  const todaysWordsUrl = (
      historicDate ? 'todays_words?date=' + historicDate : 'todays_words');
  $.get('allwords.txt').done(words => {
    allowedWords = words.split(/\r?\n/);
    todaysWords = {'L': "יצירה", 'R': "צביעה"}
    todaysNum = lastCompletedWordNum + 1;
    $('#loading-msg').hide();
    $('#start-button').show();
    $('#instructions').click(startGame);
      // todaysWords = data.todaysWords;
      // todaysNum = data.todaysNum;
      loadState();
      // if (todaysNum <= lastCompletedWordNum && !historicDate) {
      //   // Already played today's game.
      //   $('#instructions').hide();
      //   if (numStepsToVictory.L >= 0 && numStepsToVictory.R >= 0) {
      //     showWinModal();
      //   } else {
      //     showLossModal();
      //   }
      // }
      // Ready to start playing.
  });
});
