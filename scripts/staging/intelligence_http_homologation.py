#!/usr/bin/env python3
"""Staging-only Auth/RLS/Edge gate. Requires two existing disposable Auth accounts.
No provider calls: Edge is invoked only after proving both accounts have empty
agent datasets, and must return sem_dados. No admin endpoint or service-role key.
"""
import os
import sys
import uuid
from urllib.parse import urlencode
from auth_http_homologation import Client, REQUIRED, HttpFailure

TABLES = ['properties', 'clients', 'deals', 'visits', 'commissions', 'commission_receipts',
          'vgv_entries', 'imobfy_attendance_threads', 'imobfy_attendance_messages',
          'imobfy_ads_daily_metrics', 'imobfy_ads_funnel_events']

def main():
    if sys.argv[1:] == ['--check']:
        print('PASS runner configuration; NOT RUN Auth/HTTP/Edge')
        return
    if sys.argv[1:] or os.getenv('IMOBFY_E2E_CONFIRM_STAGING') != '1':
        raise SystemExit('Requires IMOBFY_E2E_CONFIRM_STAGING=1 or --check')
    missing = [name for name in REQUIRED if not os.getenv(name)]
    if missing:
        raise SystemExit('BLOCKED: missing secure environment variables: ' + ', '.join(missing))
    api = Client(os.environ[REQUIRED[0]])
    accounts = [api.login(os.environ[f'IMOBFY_STAGING_USER_{letter}_EMAIL'],
                          os.environ[f'IMOBFY_STAGING_USER_{letter}_PASSWORD']) for letter in ['A','B']]
    if accounts[0][1] == accounts[1][1]:
        raise AssertionError('Distinct identities required')
    for token, _ in accounts:
        for table in TABLES:
            if api.request('GET', '/rest/v1/'+table+'?select=id&limit=1', token=token):
                raise AssertionError('Use empty disposable accounts; refuses existing business data')
        for agent in ['ads','atendimento','comercial','financeiro']:
            result = api.request('POST','/functions/v1/imobfy-specialist-agents', {'agent':agent},token)
            if result.get('coverage') != 'sem_dados' or result.get('mode') != 'regras':
                raise AssertionError('Empty specialist response must not invoke AI')
            if [task['id'] for task in result.get('plan',{}).get('tasks',[])] != ['validate-data']:
                raise AssertionError('Current specialist plan not served')
    print('PASS two real Auth sessions and eight empty-data Edge responses')
    created = []
    fixtures = []
    try:
        for token, uid in accounts:
            prop, client, thread, metric = [str(uuid.uuid4()) for _ in range(4)]
            rows = [
                ('properties',prop,{'title':'IMOBFY fictitious activation property'}),
                ('clients',client,{'name':'IMOBFY fictitious activation client'}),
                ('imobfy_attendance_threads',thread,{'client_id':client,'property_id':prop}),
                ('imobfy_ads_daily_metrics',metric,{'report_date':'2026-11-18','ad_account_id':'fixture','campaign_id':metric,'campaign_name':'Fictitious campaign','spend_brl':10,'clicks':2}),
            ]
            for table, identifier, fields in rows:
                api.request('POST','/rest/v1/'+table,dict(fields,id=identifier,user_id=uid),token)
                created.append((token,table,identifier))
            message = str(uuid.uuid4())
            api.request('POST','/rest/v1/imobfy_attendance_messages',{'id':message,'user_id':uid,'thread_id':thread,'role':'customer','body':'Fictitious qualification question'},token)
            fixtures.append(dict(properties=prop,clients=client,imobfy_attendance_threads=thread,imobfy_attendance_messages=message,imobfy_ads_daily_metrics=metric))
        for i, (token, uid) in enumerate(accounts):
            other_token, other_uid = accounts[1-i]
            for table, identifier in fixtures[i].items():
                path='/rest/v1/'+table+'?'+urlencode({'id':'eq.'+identifier})
                own=api.request('GET',path,token=token)
                if len(own)!=1 or api.request('GET',path,token=other_token)!=[]:
                    raise AssertionError('Cross-tenant read isolation failed: '+table)
            thread=fixtures[i]['imobfy_attendance_threads']
            path='/rest/v1/imobfy_attendance_threads?'+urlencode({'id':'eq.'+thread})
            api.request('PATCH',path,{'status':'paused'},other_token)
            if api.request('GET',path,token=token)[0]['status']!='open':
                raise AssertionError('Cross-tenant update changed owner record')
            try:
                api.request('POST','/rest/v1/imobfy_attendance_messages',{'user_id':other_uid,'thread_id':thread,'role':'customer','body':'Forbidden cross-tenant fixture'},other_token)
            except HttpFailure as err:
                if err.status not in (400,403,409): raise
            else: raise AssertionError('Cross-tenant reference accepted')
            try:
                api.request('POST','/rest/v1/imobfy_agent_execution_audit',{'user_id':uid},token)
            except HttpFailure as err:
                if err.status!=403: raise
            else: raise AssertionError('Client can append backend execution audit')
        print('PASS bidirectional owner CRUD, read/update isolation, foreign references and audit grants')
    finally:
        failed=[]
        # Deleting each own thread cascades only its synthetic messages.
        for token,table,identifier in reversed(created):
            try:
                api.request('DELETE','/rest/v1/'+table+'?'+urlencode({'id':'eq.'+identifier}),token=token)
            except Exception:
                failed.append({'table':table,'id':identifier})
        if failed:
            print('Fixture cleanup required:',failed,file=sys.stderr)
            raise RuntimeError('Fixture cleanup incomplete; stop release')
    print('PASS fixture cleanup; Auth accounts remain for authenticated browser testing')

if __name__ == '__main__':
    main()
