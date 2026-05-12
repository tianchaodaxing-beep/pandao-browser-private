import type { BoundaryAction, EvaluationResult, RiskLevel } from 'shared';

const QUERY_GREEN = new Set([
  'query.order.list',
  'query.order.detail',
  'query.inventory',
  'query.logistics',
  'query.message.list',
  'query.message.detail',
  'query.review.list',
  'query.report.export',
  'query.dashboard.screenshot',
  'query.product.list',
  'query.product.detail',
  'query.transaction.history'
]);

const CUSTOMER_GREEN = new Set([
  'customer.reply.neutral',
  'customer.reply.review.good'
]);

const CUSTOMER_YELLOW = new Set([
  'customer.reply.review.medium',
  'customer.reply.review.bad',
  'customer.reply.complaint',
  'customer.reply.refund_request'
]);

const PRODUCT_GREEN = new Set([
  'product.stock.update'
]);

const PRODUCT_YELLOW = new Set([
  'product.create',
  'product.unlist',
  'product.relist',
  'product.image.update',
  'product.title.update',
  'product.description.update',
  'product.category.change',
  'product.bundle.create',
  'product.discount.create'
]);

const ORDER_GREEN = new Set([
  'order.shipment.fill',
  'order.note.add'
]);

const ORDER_YELLOW = new Set([
  'order.shipment.update',
  'order.cancel',
  'order.refund.partial',
  'order.refund.full',
  'order.address.update'
]);

const BLOCK_RED = new Set([
  'account.profile.update',
  'account.logo.update',
  'account.banner.update',
  'account.password.change',
  'account.email.bind',
  'account.phone.bind',
  'account.bank.bind',
  'account.withdraw',
  'account.delete',
  'account.permission.grant',
  'account.permission.revoke',
  'product.delete'
]);

function result(riskLevel: RiskLevel, reason: string): EvaluationResult {
  return {
    riskLevel,
    approvalRequired: riskLevel === 'yellow',
    reason
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readPayloadNumber(payload: unknown, ...keys: string[]): number | null {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = readNumber(payload[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readCurrentPrice(payload: unknown, currentValue: unknown): number | null {
  const fromPayload = readPayloadNumber(payload, 'currentPrice', 'current_price', 'oldPrice', 'old_price');
  if (fromPayload !== null) {
    return fromPayload;
  }

  const direct = readNumber(currentValue);
  if (direct !== null) {
    return direct;
  }

  return readPayloadNumber(currentValue, 'currentPrice', 'current_price', 'price', 'oldPrice', 'old_price');
}

function readConfidence(payload: unknown): number | null {
  return readPayloadNumber(payload, 'confidence');
}

function evaluatePriceUpdate(action: BoundaryAction): EvaluationResult {
  const currentPrice = readCurrentPrice(action.payload, action.currentValue);
  const newPrice = readPayloadNumber(action.payload, 'newPrice', 'new_price', 'price');

  if (currentPrice === null || currentPrice <= 0 || newPrice === null || newPrice < 0) {
    return result('yellow', 'price delta unavailable; manager approval required');
  }

  const delta = Math.abs(newPrice - currentPrice) / currentPrice;
  const percentage = Math.round(delta * 1000) / 10;

  if (delta <= 0.1) {
    return result('green', `price change ${percentage}% within 10% auto boundary`);
  }

  if (delta <= 0.3) {
    return result('yellow', `price change ${percentage}% requires manager approval`);
  }

  return result('red', `price change ${percentage}% exceeds 30% red boundary`);
}

export function evaluateAction(action: BoundaryAction): EvaluationResult {
  const command = action.command.trim();

  if (!command) {
    return result('yellow', 'empty command requires manager review');
  }

  if (BLOCK_RED.has(command)) {
    return result('red', `${command} is blocked by boundary policy`);
  }

  if (command === 'product.price.update') {
    return evaluatePriceUpdate(action);
  }

  if (command === 'customer.reply.neutral') {
    const confidence = readConfidence(action.payload);
    if (confidence !== null && confidence < 0.8) {
      return result('yellow', 'customer reply confidence below 0.8 requires approval');
    }
    return result('green', 'neutral customer reply is allowed');
  }

  if (QUERY_GREEN.has(command) || CUSTOMER_GREEN.has(command) || PRODUCT_GREEN.has(command) || ORDER_GREEN.has(command)) {
    return result('green', `${command} is allowed by boundary policy`);
  }

  if (CUSTOMER_YELLOW.has(command) || PRODUCT_YELLOW.has(command) || ORDER_YELLOW.has(command)) {
    return result('yellow', `${command} requires manager approval`);
  }

  if (command.startsWith('account.')) {
    return result('red', `${command} is blocked by account policy`);
  }

  return result('yellow', `${command} is not in the allow list; manager approval required`);
}
