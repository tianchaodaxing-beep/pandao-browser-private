import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateAction } from '../src/modules/boundary/rules.ts';

describe('boundary rules', () => {
  it('allows product price updates within 10 percent', () => {
    const result = evaluateAction({
      command: 'product.price.update',
      payload: { currentPrice: 100, newPrice: 109.9 }
    });

    assert.equal(result.riskLevel, 'green');
    assert.equal(result.approvalRequired, false);
  });

  it('requires approval for product price updates over 10 percent', () => {
    const result = evaluateAction({
      command: 'product.price.update',
      payload: { currentPrice: 100, newPrice: 110.1 }
    });

    assert.equal(result.riskLevel, 'yellow');
    assert.equal(result.approvalRequired, true);
  });

  it('keeps product price updates under 30 percent in yellow', () => {
    const result = evaluateAction({
      command: 'product.price.update',
      payload: { currentPrice: 100, newPrice: 129.9 }
    });

    assert.equal(result.riskLevel, 'yellow');
    assert.equal(result.approvalRequired, true);
  });

  it('blocks product price updates over 30 percent', () => {
    const result = evaluateAction({
      command: 'product.price.update',
      payload: { currentPrice: 100, newPrice: 130.1 }
    });

    assert.equal(result.riskLevel, 'red');
    assert.equal(result.approvalRequired, false);
  });

  it('downgrades price updates without current price to yellow', () => {
    const result = evaluateAction({
      command: 'product.price.update',
      payload: { newPrice: 90 }
    });

    assert.equal(result.riskLevel, 'yellow');
    assert.equal(result.approvalRequired, true);
  });

  it('blocks account password changes', () => {
    const result = evaluateAction({
      command: 'account.password.change',
      payload: {}
    });

    assert.equal(result.riskLevel, 'red');
  });

  it('downgrades low-confidence neutral customer replies', () => {
    const result = evaluateAction({
      command: 'customer.reply.neutral',
      payload: { confidence: 0.6 }
    });

    assert.equal(result.riskLevel, 'yellow');
    assert.equal(result.approvalRequired, true);
  });

  it('allows high-confidence neutral customer replies', () => {
    const result = evaluateAction({
      command: 'customer.reply.neutral',
      payload: { confidence: 0.9 }
    });

    assert.equal(result.riskLevel, 'green');
    assert.equal(result.approvalRequired, false);
  });
});
