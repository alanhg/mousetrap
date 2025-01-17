/**
 * This extension allows you to record a sequence using Mousetrap.
 *
 * @author Dan Tao <daniel.tao@gmail.com>
 */
(function(Mousetrap) {
    /**
     * the sequence currently being recorded
     *
     * @type {Array}
     */
    var _recordedSequence = [],

        /**
         * a callback to invoke after recording a sequence
         *
         * @type {Function|null}
         */
        _recordedSequenceCallback = null,

        /**
         * a list of all of the keys currently held down
         *
         * @type {Array}
         */
        _currentRecordedKeys = [],

        /**
         * temporary state where we remember if we've already captured a
         * character key in the current combo
         *
         * @type {boolean}
         */
        _recordedCharacterKey = false,

        /**
         * a handle for the timer of the current recording
         *
         * @type {null|number}
         */
        _recordTimer = null,

        /**
         * the original handleKey method to override when Mousetrap.record() is
         * called
         *
         * @type {Function}
         */
        _origHandleKey = Mousetrap.prototype.handleKey,

        /**
         * The options currently used.
         *
         * @type {Object}
         * @property {boolean} recordSequence - Whether or not to record key sequence.
         */
        _options = {},

        /**
         * The default options.
         *
         * @type {Object}
         * @property {boolean} recordSequence - Whether or not to record key sequence.
         */
        _defaultOptions = {
            recordSequence: true
        };

    /**
     * handles a character key event
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event} e
     * @returns void
     */
    var _lastHandledKeyCombo = null;
    function _handleKey(character, modifiers, e) {
        var self = this;

        if (!self.recording) {
            _origHandleKey.apply(self, arguments);
            return;
        }

        if (e.type == 'keyup') {
            _lastHandledKeyCombo = null; // 重置最后处理的按键组合
        }

        // remember this character if we're currently recording a sequence
        if (e.type == 'keydown') {

            // To record shortcuts handled by the browser (mod+s ...)
            e.preventDefault();

            if (character.length === 1 && _recordedCharacterKey) {
                _recordCurrentCombo();
            }

            for (var i = 0; i < modifiers.length; ++i) {
                _recordKey(modifiers[i]);
            }
            _recordKey(character);
            var keyCombo = Array.from(new Set(modifiers.concat(character))).join('+');

            // 检查这个按键组合是否与上一个处理过的按键组合不同
            if (_lastHandledKeyCombo !== keyCombo) {
                _lastHandledKeyCombo = keyCombo; // 更新最后处理的按键组合

                self.liveUpdateCallback(keyCombo); // 调用实时更新显示的方法
            }

            // once a key is released, all keys that were held down at the time
            // count as a keypress
        } else if (e.type == 'keyup' && _currentRecordedKeys.length > 0) {
            _recordCurrentCombo();
        }
    }

    /**
     * marks a character key as held down while recording a sequence
     *
     * @param {string} key
     * @returns void
     */
    function _recordKey(key) {
        var i;

        // one-off implementation of Array.indexOf, since IE6-9 don't support it
        for (i = 0; i < _currentRecordedKeys.length; ++i) {
            if (_currentRecordedKeys[i] === key) {
                return;
            }
        }

        _currentRecordedKeys.push(key);

        if (key.length === 1) {
            _recordedCharacterKey = true;
        }
    }

    /**
     * marks whatever key combination that's been recorded so far as finished
     * and gets ready for the next combo
     *
     * @returns void
     */
    function _recordCurrentCombo() {
        _recordedSequence.push(_currentRecordedKeys);
        _currentRecordedKeys = [];
        _recordedCharacterKey = false;
        _restartRecordTimer();
    }

    /**
     * ensures each combo in a sequence is in a predictable order and formats
     * key combos to be '+'-delimited
     *
     * modifies the sequence in-place
     *
     * @param {Array} sequence
     * @returns void
     */
    function _normalizeSequence(sequence) {
        var i;

        for (i = 0; i < sequence.length; ++i) {
            sequence[i].sort(function(x, y) {
                // modifier keys always come first, in alphabetical order
                if (x.length > 1 && y.length === 1) {
                    return -1;
                } else if (x.length === 1 && y.length > 1) {
                    return 1;
                }

                // character keys come next (list should contain no duplicates,
                // so no need for equality check)
                return x > y ? 1 : -1;
            });

            sequence[i] = sequence[i].join('+');
        }
    }

    /**
     * finishes the current recording, passes the recorded sequence to the stored
     * callback, and sets Mousetrap.handleKey back to its original function
     *
     * @returns void
     */
    function _finishRecording() {
        var sequence = _recordedSequence;
        var callback = _recordedSequenceCallback;

        // Reset the state before before calling the callback
        // in case the callback restarts the record
        _resetState();

        if (callback) {
            _normalizeSequence(sequence);
            callback(sequence);
        }
    }

    /**
     * Reset all recorded state
     *
     * @returns void
     */
    function _resetState() {
        _recordedSequence = [];
        _recordedSequenceCallback = null;
        _currentRecordedKeys = [];
    }

    /**
     * called to set a 1 second timeout on the current recording
     *
     * this is so after each key press in the sequence the recording will wait for
     * 1 more second before executing the callback
     *
     * @returns void
     */
    function _restartRecordTimer() {
        clearTimeout(_recordTimer);
        if (_options.recordSequence) {
            _recordTimer = setTimeout(_finishRecording, 1000);
        } else {
            _finishRecording();
        }
    }

    /**
     * copies object properties from source object to dest object
     *
     * @param {Object} dest
     * @param {Object} source
     * @returns {Object} the dest object
     */
    function _extend(dest, source) {
        for (var prop in source) {
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
        return dest;
    }

    /**
     * records the next sequence and passes it to a callback once it's
     * completed
     *
     * @param {Object} [options]
     * @param {boolean} [options.recordSequence=true] - Whether or not to record key sequences.
     * @param {Function} callback
     * @returns void
     */
    Mousetrap.prototype.record = function (options, callback, liveUpdateCallback) {
        _options = _extend({}, _defaultOptions);
        if(typeof options === 'function') {
            callback = options;
        } else {
            _extend(_options, options);
        }

        var self = this;
        self.recording = true;
        _recordedSequenceCallback = function() {
            self.recording = false;
            callback.apply(self, arguments);
        };
        self.liveUpdateCallback = liveUpdateCallback || function() {};
    };

    /**
     * Manually stops the record
     *
     * @returns void
     */
    Mousetrap.prototype.stopRecord = function() {
        this.recording = false;
        _resetState();
    };

    Mousetrap.prototype.handleKey = function() {
        var self = this;
        _handleKey.apply(self, arguments);
    };

    Mousetrap.init();

})(Mousetrap);