import createLogger from '../../../utils/logger';

const log = createLogger('screenActions');

export function gotoScreen(screen, item = null) {
    return {
        type: 'SCREEN/OPEN',
        screen,
        item,
    };
}

export function showError(msg) {
    log.error('Show error', msg);
    if (typeof msg === 'object') {
        msg = msg.message;
    }
    return {
        type: 'SCREEN/ERROR',
        message: msg,
    };
}

export function closeError() {
    return {
        type: 'SCREEN/ERROR',
        message: null,
    };
}

export function showDialog(name, item = null) {
    return {
        type: 'SCREEN/DIALOG',
        value: name,
        item,
    };
}

export function closeDialog() {
    return {
        type: 'SCREEN/DIALOG',
        value: null,
        item: null,
    };
}

export function catchError(dispatch) {
    return (err) => {
        dispatch(showError(err));
    };
}
