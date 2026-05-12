import type {
  CredentialExchangeRequest,
  CredentialExchangeResponse,
  CredentialTokenResponse
} from 'shared';
import { requestAuthedJson } from '../browser-engine/api-client.js';

export async function requestCredentialToken(shopId: number): Promise<CredentialTokenResponse> {
  return requestAuthedJson<CredentialTokenResponse>(`/shops/${shopId}/credential-token`, {
    method: 'GET'
  });
}

export async function exchangeCredentialToken(token: string): Promise<CredentialExchangeResponse> {
  const body: CredentialExchangeRequest = { token };
  return requestAuthedJson<CredentialExchangeResponse>('/credentials/exchange', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
