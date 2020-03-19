/**
 * Package that contains our listener class that listens to events (e.g. 
 * clock-in requests, payment requests, etc).
 * @module @tutorbook/listener
 * @see {@link https://npmjs.com/package/@tutorbook/listener}
 *
 * @license
 * Copyright (C) 2020 Tutorbook
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see {@link https://www.gnu.org/licenses/}.
 */

import to from 'await-to-js';

const Utils = require('@tutorbook/utils');
const Data = require('@tutorbook/data');
const ConfirmationDialog = require('@tutorbook/dialogs').confirm;

/**
 * Class that enables the client to listen to remote events (e.g. Firestore
 * database triggers or HTTP request responses).
 * @todo Finish documentation.
 */
class Listener {

    constructor() {
        switch (window.app.user.type) {
            case 'Supervisor':
                return this.supervisor();
            case 'Tutor':
                return this.tutor();
            case 'Pupil':
                return this.pupil();
        };
    }

    async supervisor() {
        const locationDocs = await window.app.db.collection('locations')
            .where('supervisors', 'array-contains', window.app.user.uid).get();
        const clockIns = {
            remove: (doc) => {},
            display: (doc) => {
                const data = doc.data();
                const title = 'Approve Clock-In?';
                const summary = data.sentBy.name + ' clocked in at ' +
                    Utils.getTimeString(data.sentTimestamp) + ' for ' +
                    Utils.getPronoun(data.sentBy.gender) + ' appointment with ' +
                    Utils.getOther(data.sentBy, data.for.attendees).name + ' at ' +
                    data.for.time.from + '. Approve this clock-in request?';
                new ConfirmationDialog(title, summary, async () => {
                    window.app.snackbar.view('Approving clock-in request...');
                    const [err, res] = await to(
                        Data.approveClockIn(doc.data(), doc.id));
                    if (err) return window.app.snackbar.view('Could not ' +
                        'approve clock-in request.');
                    window.app.snackbar.view('Approved clock-in request.');
                }, true, async () => {
                    window.app.snackbar.view('Rejecting clock-in request...');
                    const [err, res] = await to(
                        Data.rejectClockIn(doc.data(), doc.id));
                    if (err) return window.app.snackbar.view('Could not ' +
                        'reject clock-in request.');
                    window.app.snackbar.view('Rejected clock-in request.');
                }).view();
            },
        };
        locationDocs.forEach(locationDoc => {
            const db = locationDoc.ref;
            window.app.listeners.push(db.collection('clockIns').onSnapshot({
                error: (err) => {
                    window.app.snackbar.view('Could not listen to clock-in ' +
                        'requests. Reload to try again.');
                    console.error('[ERROR] Couldn\'t get clock-ins b/c of ',
                        err);
                },
                next: (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'removed') {
                            clockIns.remove(change.doc);
                        } else {
                            clockIns.display(change.doc);
                        }
                    });
                },
            }));
        });
        const clockOuts = {
            remove: (doc) => {},
            display: (doc) => {
                const data = doc.data();
                const title = 'Approve Clock-Out?';
                const summary = data.sentBy.name + ' clocked out at ' +
                    Utils.getTimeString(data.sentTimestamp) + ' for ' +
                    Utils.getPronoun(data.sentBy.gender) + ' appointment with ' +
                    Utils.getOther(data.sentBy, data.for.attendees).name +
                    ' ending at ' + data.for.time.to + '. Approve this clock-' +
                    'out request?';
                new ConfirmationDialog(title, summary, async () => {
                    window.app.snackbar.view('Approving clock-out request...');
                    const [err, res] = await to(
                        Data.approveClockOut(doc.data(), doc.id));
                    if (err) return window.app.snackbar.view('Could not ' +
                        'approve clock-out request.');
                    window.app.snackbar.view('Approved clock-out request.');
                }, true, async () => {
                    window.app.snackbar.view('Rejecting clock-out request...');
                    const [err, res] = await to(
                        Data.rejectClockOut(doc.data(), doc.id));
                    if (err) return window.app.snackbar.view('Could not ' +
                        'reject clock-out request.');
                    window.app.snackbar.view('Rejected clock-out request.');
                }).view();
            },
        };
        locationDocs.forEach(locationDoc => {
            const db = locationDoc.ref;
            window.app.listeners.push(db.collection('clockOuts').onSnapshot({
                error: (err) => {
                    window.app.snackbar.view('Could not listen to clock-out ' +
                        'requests. Reload to try again.');
                    console.error('[ERROR] Couldn\'t get clock-outs b/c of ',
                        err);
                },
                next: (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'removed') {
                            clockOuts.remove(change.doc);
                        } else {
                            clockOuts.display(change.doc);
                        }
                    });
                },
            }));
        });
    }

    tutor() {}

    /**
     * Listens to payment requests (that paid tutors send to their clients after
     * a good lesson).
     * @todo Enable pupils to reject those payment requests and add a reason
     * why (e.g. a review of some sort).
     */
    pupil() {
        const payments = {
            remove: (doc) => {},
            display: (doc) => {
                const data = doc.data();
                const title = 'Approve Payment?';
                const summary = data.to.name + ' is requesting payment ($' +
                    data.amount.toFixed(2) + ') for your tutoring lesson on ' +
                    data.for.for.subject + ' on ' + data.for.time.day + ' at ' +
                    data.for.time.from + '. Approve payment and send ' +
                    data.to.name.split(' ')[0] + ' $' + data.amount.toFixed(2) +
                    '?';
                new ConfirmationDialog(title, summary, async () => {
                    window.app.snackbar.view('Approving payment request...');
                    const [err, res] = await to(
                        Data.approvePayment(doc.data(), doc.id));
                    if (err) return window.app.snackbar.view('Could not ' +
                        'approve payment.');
                    window.app.snackbar.view('Approved and sent $' +
                        data.amount.toFixed(2) + ' to ' + data.to.email + '.');
                }, true).view();
            }
        };
        window.app.listeners.push(window.app.db.collection('users')
            .doc(window.app.user.uid)
            .collection('requestedPayments').onSnapshot({
                error: (err) => {
                    window.app.snackbar.view('Could not listen to requested ' +
                        'payments. Reload to try again.');
                    console.error('[ERROR] Could not listen to requested ' +
                        'payments b/c of ', err);
                },
                next: (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'removed') {
                            payments.remove(change.doc);
                        } else {
                            payments.display(change.doc);
                        }
                    });
                },
            }));
    }
};


module.exports = Listener;