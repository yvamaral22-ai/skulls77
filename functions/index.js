'use strict';

const admin = require('firebase-admin');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.adminUpdateStaffPassword = onCall({
  region: 'us-central1',
  cors: true
}, async (request) => {
  const caller = request.auth;

  if (!caller?.uid) {
    throw new HttpsError('unauthenticated', 'Autenticacao obrigatoria.');
  }

  const targetUid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  const newPassword = typeof request.data?.newPassword === 'string' ? request.data.newPassword : '';

  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'Funcionario invalido.');
  }

  if (targetUid === caller.uid) {
    throw new HttpsError('failed-precondition', 'Use o fluxo normal para trocar a propria senha.');
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'A nova senha precisa ter pelo menos 6 caracteres.');
  }

  const callerDoc = await admin.firestore().collection('users').doc(caller.uid).get();
  const callerPermissions = callerDoc.exists ? callerDoc.get('permissions') : null;

  if (callerPermissions !== 'master') {
    throw new HttpsError('permission-denied', 'Somente masters podem alterar senhas da equipe.');
  }

  const targetDocRef = admin.firestore().collection('users').doc(targetUid);
  const targetDoc = await targetDocRef.get();

  if (!targetDoc.exists || targetDoc.get('deleted') === true) {
    throw new HttpsError('not-found', 'Funcionario nao encontrado.');
  }

  await admin.auth().updateUser(targetUid, { password: newPassword });

  await targetDocRef.set({
    passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    passwordUpdatedBy: caller.uid
  }, { merge: true });

  return { success: true };
});
