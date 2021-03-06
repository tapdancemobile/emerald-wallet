import React from 'react';
import { convert } from 'emerald-js';
import Immutable from 'immutable';
import { connect } from 'react-redux';
import { Field, reduxForm } from 'redux-form';
import { change, formValueSelector, reset, SubmissionError } from 'redux-form';
import TextField from 'elements/Form/TextField';
import Button from 'elements/Button';


import tokens from 'store/vault/tokens';
import { required, address } from 'lib/validators';

import TokenUnits from 'lib/tokenUnits';

import Token from '../token';

import styles from './add.scss';

class AddToken extends React.Component {

    render() {
        const { token, submitSucceeded, handleSubmit, invalid, pristine, submitting } = this.props;
        const { clearToken } = this.props;

        return (

            <div>
                <form onSubmit={handleSubmit}>
                { !token &&
                    <div>
                            <div>
                                <Field
                                    name="address"
                                    component={ TextField }
                                    underlineShow={ false }
                                    fullWidth={ true }
                                    hintText="Token Contract Address"
                                    type="text"
                                    label="Token Contract Address"
                                    validate={ [required, address] }
                                />
                            </div>
                            <div className={ styles.actionButtons }>
                                <Button
                                    primary
                                    label="Submit"
                                    type="submit"
                                    disabled={pristine || submitting || invalid }
                                />
                            </div>
                    </div>
                }
                { token &&
                    (
                        <div>
                            <div>
                                <table>
                                    <tbody>
                                    <tr>
                                        <td>Address</td>
                                        <td>{ token.address }</td>
                                    </tr>
                                    <tr>
                                        <td>Symbol</td>
                                        <td>{ token.symbol }</td>
                                    </tr>
                                    <tr>
                                        <td>Total supply</td>
                                        <td>{ new TokenUnits(token.totalSupply, token.decimals).getDecimalized() }</td>
                                    </tr>
                                    <tr>
                                        <td>Decimals</td>
                                        <td>{ convert.toNumber(token.decimals) }</td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className={ styles.actionButtons }>
                                <Button
                                    primary
                                    label="Add"
                                    type="submit"
                                    disabled={pristine || submitting || invalid }
                                />
                                <Button
                                    label="Cancel"
                                    onClick={ clearToken }
                                    disabled={ pristine || submitting || invalid }
                                />
                            </div>
                        </div>
                    )
                }
            </form>
            </div>
        );
    }
}

const AddTokenForm = reduxForm({
    form: 'addToken',
    fields: ['address', 'name', 'token'],
})(AddToken);

export default connect(
    (state, ownProps) => {
        const selector = formValueSelector('addToken');
        const token = (selector(state, 'token'));
        return {
            token,
        };
    },
    (dispatch, ownProps) => ({
        onSubmit: (data) => {
            if (data.token) {
                return dispatch(tokens.actions.addToken(data.address))
                    .then(dispatch(reset('addToken')))
                    .then(dispatch(tokens.actions.loadTokenBalances(data)));
            } else {
                return tokens.actions.fetchTokenDetails(data.address)
                    .then((result) => {
                        return dispatch(change('addToken', 'token', result));
                    });
            }
        },
        clearToken: () => dispatch(reset('addToken')),

    })
)(AddTokenForm);
