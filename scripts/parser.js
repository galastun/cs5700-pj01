const machineInput = document.getElementById('machine-input');
const stringInput = document.getElementById('string-input');
const downloadCheckbox = document.getElementById('download-content');
const states = ['DFA', 'NFA', 'INVALID'];
const machines = {};
let downloadWhenDone = downloadCheckbox.checked;

/**
 * Special case of Error for hitting the trap state
 */
class TrapState extends Error {
  constructor(message) {
    super(message);
  }
}

/**
 * State Object that holds a reference on what states to transition to when
 * certain characters are encountered.
 */
class StateObj {
  constructor(stateName, isAcceptState) {
    this.stateName = stateName;
    this.isAcceptState = isAcceptState;
    this.isEpsilon = false;
    this.nextState = {
      " ": this, // stay here on empty string
    };
  }

  /**
   * Adds a string to the machine and then return the next state based on the character.
   * @param {String} str The character to add to the machine
   * @returns {Object}
   */
  addString(str) {
    if (!this.nextState.hasOwnProperty(str)) {
      throw new TrapState(`Invalid string for transition: ${str}; Valid strings: ${Object.keys(this.nextState)}`);
    }

    if (this.nextState[str].isEpsilon) {
      return this.nextState[str].nextState;
    }

    return this.nextState[str];
  }

  /**
   * Tells the state what the next state is when a character is encountered
   * @param {String} str The character to track
   * @param {*} nextState The state to go to when this character is hit
   * @returns {Number}
   */
  onString(str, nextState) {
    let state = 0;
    if (!isValidChar(str)) {
      throw new Error(`Invalid character: ${str}`);
    }

    // if there is an epsilon transfer, we have an NFA
    if (str === '`') {
      state = 1;
      this.isEpsilon = true;
      this.nextState = nextState;
      return state;
    }

    if (!this.nextState.hasOwnProperty(str)) {
      this.nextState[str] = nextState;
      state = 0;
    } else {
      const stateArray = Array.isArray(this.nextState[str]) ? this.nextState[str] : [this.nextState[str]];
      this.nextState[str] = [...stateArray, nextState];
      state = 1;
    }

    return state;
  }
}

/**
 * Handles the download of the file by creating an 'a' element and then 'clicking' it.
 * @param {String} name The name of the file
 * @param {String} text The text to add to the file
 */
function download(name, text) {
  const element = document.createElement('a');
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
  element.setAttribute('download', name);

  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * Returns the name portion of the file name
 * @param {String} file The file name with the extension
 */
function getFileName(file) {
  return file.split('.')[0];
}

/**
 * Tests an individual character for validity
 * @param {String} char The character to test for validity
 */
function isValidChar(char) {
  const regex = new RegExp('[\!\"#\$%&\'\(\)\*\+,\-\./0123456789:;<=>\?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\[\\\]\^_`abcdefghijklmnopqrstuvwxyz{|}~]');
  return regex.test(char);
}

/**
 * Process the machine and displays it in the HTML machine-output element.
 * @param {Object} obj The machine object with name, type, and reason (if invalid).
 */
function addToDom(obj) {
  const machineOutput = document.getElementById('machine-item-list');

  const div = document.createElement('div');
  const name = document.createElement('span');
  const validity = document.createElement('span');
  const numStates = document.createElement('span');
  const reason = document.createElement('span');
  const count = document.createElement('span');

  name.textContent = obj.name;
  validity.textContent = states[obj.type];
  numStates.textContent = obj.states;
  count.textContent = obj.validStrings;
  count.id = `${getFileName(obj.name)}-count`;

  div.classList.add('machine-item');
  div.appendChild(name);
  div.appendChild(validity);
  div.appendChild(numStates);
  div.appendChild(count);

  if (obj.hasOwnProperty('reason')) {
    reason.textContent = obj.reason;
    div.appendChild(reason);
  }

  machineOutput.appendChild(div);
}

/**
 * 
 * @param {String} name Base name of the machine.
 * @param {Number} count The amount of valid strings
 */
function updateDom(name, count) {
  const countEl = document.getElementById(`${name}-count`);
  countEl.innerText = count;
}

/**
 * Called recursively in case of an NFA. It will iterate over all options until it finds a good path
 * or it exhausts other options.
 * @param {String[]} line Tokens of the string
 * @param {*} currentState The current state object
 */
function isValidString(line, currentState) {
  const [currentChar] = line.slice();
  
  if (!currentChar) {
    return currentState.isAcceptState;
  }

  if (!isValidChar(currentChar)) {
    throw new Error(`Invalid character: ${char}`);
  }

  if (Array.isArray(currentState)) { // NFA, multiple paths
    let acceptingState = null;
    for (i = 0; i < currentState.length; i++) {
      acceptingState = isValidString(line.slice(1), currentState[i].addString(currentChar));

      if (acceptingState) {
        return true;
      }
    }
  } else {
    return isValidString(line.slice(1), currentState.addString(currentChar));
  }
}

/**
 * Validates the accept states at the start of the file
 * @param {String} text The start state
 * @returns {String[]}
 */
function getAcceptStates(text) {
  const matches = text.match(/{(?<states>\d*(,\d+)*)}/);

  if (!matches.length) {
    throw new Error('INVALID');
  }

  const { states } = matches.groups;

  return states.split(',');
}

/**
 * Builds the log file and then downloads it based on machine data.
 * @param {Object} machines The machines object
 */
function processLogFile(machines) {
  const logArray = [];
  Object.entries(machines).forEach(([key, value]) => {
    const machineValues = [
      key,
      states[value.type],
      value.states,
      value.validStrings,
    ];

    logArray.push(machineValues.join(','));
  });

  if (downloadWhenDone) {
    download('fa.log', logArray.join('\n'));
  }
}

/**
 * First gets the valid Accept states and then handles the transitions between states.
 * @param {String[]} fileLines An array of the lines of the file.
 */
function parseMachineFile(fileLines) {
  const machine = {
    type: 0, // 0 is DFA
    states: 0,
    validStrings: 0,
  };

  try{
    const acceptStates = getAcceptStates(fileLines.shift());  
    fileLines.forEach((transition) => {
      if (!transition.length) {
        return;
      }
  
      const [start, value, next] = transition.split(',');

      if (parseInt(start) > 255 || parseInt(next) > 255) {
        throw new Error('Invalid state number');
      }

      if (!machine.hasOwnProperty(start)) {
        machine[start] = new StateObj(start, acceptStates.includes(start));
        machine.states++;
      }

      if (!machine.hasOwnProperty(next)) {
        machine[next] = new StateObj(next, acceptStates.includes(next));
        machine.states++;
      }

      machine.type = Math.max(machine.type, machine[start].onString(value, machine[next]));
    });
  } catch (e) {
    machine.type = 2; // INVALID
    machine.reason = e.message;
  }

  return machine;
}

/**
 * Process the file by getting the name and then handling it line-by-line. Once it is processed,
 * it is added to the HTML DOM.
 * @param {File} file The file that was uploaded
 */
function handleMachineFile(file) {
  const fileName = getFileName(file.name);
  const reader = new FileReader();
  reader.onload = (e) => {
    const { result } = e.target;
    const lines = result.split(/\r\n|\r|\n/g);
    machines[fileName] = parseMachineFile(lines);
    machines[fileName].name = file.name;
    
    addToDom(machines[fileName]);
  };
  reader.readAsText(file);
}

/**
 * Handles the processing of the txt file with all the strings to validate.
 * @param {File} file The file object from the input
 */
function handleStringFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const { result } = e.target;
    const lines = result.split(/\r\n|\r|\n/g);

    Object.entries(machines).forEach(([key, value]) => {
      const acceptedStrings = [];
      let trapStateHit = false;

      lines.forEach((line) => {
        const startState = value[0];
        let currentState = startState;
        try {
          const isValid = isValidString(line.split(''), currentState);
          
          if (isValid) {
            machines[key].validStrings++;
            acceptedStrings.push(line);
          }
        } catch (e) {
          if (e instanceof TrapState) {
            trapStateHit = true; // hit an implicit trap state
          } 
        }
      });

      updateDom(key, machines[key].validStrings);

      // implicit trap state hit
      if (trapStateHit) {
        machines[key].states += 1;
      }

      // download basename.txt file
      if (downloadWhenDone) {
        download(key, acceptedStrings.join('\n'));
      }
    });

    processLogFile(machines);
  };
  reader.readAsText(file);
}

/**
 * Handle the uploading of multiple files.
 */
machineInput.addEventListener('change', (e) => {
  Array.from(machineInput.files).forEach(file => handleMachineFile(file));
});

/**
 * Handle uploading the input file
 */
stringInput.addEventListener('change', (e) => {
  handleStringFile(stringInput.files[0]);
});

/**
 * Check on whether files should be downloaded
 */
downloadCheckbox.addEventListener('click', () => {
  downloadWhenDone = downloadCheckbox.checked;
});
