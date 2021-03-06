import Immutable from 'immutable';
import BigNumber from 'bignumber.js';
import { change, formValueSelector, SubmissionError } from 'redux-form';
import { Wei, convert } from 'emerald-js';
import { connect } from 'react-redux';
import { closeConnection, setWatch } from 'store/ledgerActions';
import { etherToWei, estimateGasFromTrace } from 'lib/convert';
import { address } from 'lib/validators';

import accounts from 'store/vault/accounts';
import Tokens from 'store/vault/tokens';
import screen from 'store/wallet/screen';

import CreateTxForm from './createTxForm';
import createLogger from '../../../utils/logger';

const log = createLogger('CreateTx');

const DefaultGas = 21000;
const DefaultTokenGas = 23890;

const { toHex } = convert;

const traceValidate = (data, dispatch) => {
    const dataObj = {
        from: data.from,
        gasPrice: toHex(data.gasPrice.value()),
        gas: toHex(data.gas),
        to: data.to,
        value: toHex(etherToWei(data.value)),
    };
    const resolveValidate = (response, resolve, reject) => {
        let errors = null;
        dataObj.data = (((response.trace || [])[0] || {}).action || {}).input;
        let gasEst;
        if (response.gas) {
            gasEst = response.gas;
        } else {
            gasEst = estimateGasFromTrace(dataObj, response);
            gasEst = (gasEst && gasEst.div(dataObj.gasPrice).toString(10));
        }
        if (!gasEst) {
            errors = { value: 'Invalid Transaction' };
        } else if (gasEst > data.gas) {
            errors = { gas: `Insufficient Gas: Expected ${gasEst}` };
        } else {
            resolve(gasEst);
        }
        reject({ _error: JSON.stringify(errors)});
    };

    if (data.token.length > 1) {
        return new Promise((resolve, reject) => {
            dispatch(Tokens.actions.traceTokenTransaction(
                data.from,
                data.to,
                dataObj.gas,
                dataObj.gasPrice,
                dataObj.value,
                data.token,
                data.isTransfer
            )).then((response) => resolveValidate(response, resolve, reject))
                .catch((error) => {
                    reject({ _error: (error.message || JSON.stringify(error)) });
                });
        });
    }
    return new Promise((resolve, reject) => {
        dispatch(Tokens.actions.traceCall(data.from,
            data.to,
            dataObj.gas,
            dataObj.gasPrice,
            dataObj.value))
            .then((response) => resolveValidate(response, resolve, reject))
            .catch((error) => reject({ _error: (error.message || JSON.stringify(error))}));
    });
};

const getGasPrice = (state) => state.network.get('gasPrice');

const CreateTx = connect(
    (state, ownProps) => {
        const selector = formValueSelector('createTx');
        const tokens = state.tokens.get('tokens');
        const balance = ownProps.account.get('balance');
        const gasPrice = getGasPrice(state);

        const fiatRate = state.wallet.settings.get('localeRate');
        const fiatCurrency = state.wallet.settings.get('localeCurrency');

        const value = (selector(state, 'value')) ? selector(state, 'value') : 0;
        const fromAddr = (selector(state, 'from'));
        const useLedger = ownProps.account.get('hardware', false);
        const ledgerConnected = state.ledger.get('connected');

        const gasLimit = selector(state, 'gas') ? new BigNumber(selector(state, 'gas')) : new BigNumber(DefaultGas);
        const fee = gasPrice.mul(gasLimit);

        return {
            initialValues: {
                from: ownProps.account.get('id'),
                gas: DefaultGas,
                token: '',
                isTransfer: 'true',
                gasPrice,
                balance,
                fee,
            },
            accounts: state.accounts.get('accounts', Immutable.List()),
            addressBook: state.addressBook.get('addressBook'),

            tokens: Immutable.fromJS([{ address: '', symbol: 'ETC' }]),

            // TODO: doesn't work yet
            // tokens: tokens.unshift(Immutable.fromJS({ address: '', symbol: 'ETC' })),
            isToken: (selector(state, 'token')),
            fiatRate,
            fiatCurrency,
            value: new Wei(etherToWei(value)),
            balance: selector(state, 'balance'),
            fromAddr,
            useLedger,
            ledgerConnected,
            fee,
        };
    },
    (dispatch, ownProps) => ({
        onSubmit: (data) => {
            log.debug(data);
            const useLedger = ownProps.account.get('hardware', false);

            return traceValidate(data, dispatch)
                .then((result) => {
                    if (data.token.length > 1) {
                        log.error('unsupported');
                        return;
                    }
                    log.debug('Send transaction');
                    dispatch(setWatch(false));
                    closeConnection().then(() => {
                        if (useLedger) {
                            dispatch(screen.actions.showDialog('sign-transaction', data));
                        }
                        dispatch(
                            accounts.actions.sendTransaction(
                                data.from,
                                data.password,
                                data.to,
                                toHex(data.gas),
                                toHex(data.gasPrice.value()),
                                toHex(etherToWei(data.value)))
                        );
                    });
                })
                .catch((err) => {
                    log.error('Validation failure', err);
                    throw new SubmissionError(err);
                });
        },
        onChangeAccount: (all, value) => {
            // load account information for selected account
            const idx = all.findKey((acct) => acct.get('id') === value);
            const balance = all.get(idx).get('balance');
            dispatch(change('createTx', 'balance', balance));
        },
        onEntireBalance: (value, fee) => {
            if (value) {
                const amount = new Wei(BigNumber.max(value.sub(fee).value(), new BigNumber(0)));
                dispatch(change('createTx', 'value', amount.getEther(8)));
            }
        },
        onChangeGasLimit: (event, value) => {
            if (value) {
                dispatch(change('createTx', 'gas', value));
            }
        },
        onChangeToken: (event, value, prev) => {
            // if switching from ETC to token, change default gas
            if (prev.length < 1 && !(address(value))) {
                dispatch(change('createTx', 'gas', DefaultTokenGas));
            } else if (!(address(prev)) && value.length < 1) {
                dispatch(change('createTx', 'gas', DefaultGas));
            }
        },
        handleSelect: (event, item) => {
            dispatch(change('createTx', 'to', item.props.value));
        },
        cancel: () => {
            dispatch(screen.actions.gotoScreen('account', ownProps.account));
        },
        goDashboard: () => {
            dispatch(screen.actions.gotoScreen('home', ownProps.account));
        },
    })
)(CreateTxForm);


export default CreateTx;
