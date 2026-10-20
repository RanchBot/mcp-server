import { handleTool as correctEvent } from '../../tools/correct_traceability_event';
import { handleTool as createEvent } from '../../tools/create_traceability_event';
import { handleTool as findHistory } from '../../tools/find_identifier_history';
import { handleTool as report } from '../../tools/traceability_report';
import { handleTool as voidEvent } from '../../tools/void_traceability_event';
import { registerTools } from '../../tools/index';

const farmId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';

describe('stdio traceability request-key contract', () => {
  it('forwards an opaque non-UUID key byte-for-byte', async () => {
    const client = {
      createTraceabilityEvent: jest.fn().mockResolvedValue({ event: { id: 'e1' } }),
    };
    await createEvent(client as any, farmId, {
      request_key: 'sale-2026-04-10-001',
      payload: { schema_version: 1 },
    });
    expect(client.createTraceabilityEvent).toHaveBeenCalledWith(farmId, {
      request_key: 'sale-2026-04-10-001',
      source: undefined,
      payload: { schema_version: 1 },
    });
  });

  it('rejects empty and over-200-character keys before dispatch', async () => {
    for (const name of ['create', 'correct', 'void']) {
      const client = {
        createTraceabilityEvent: jest.fn(),
        correctTraceabilityEvent: jest.fn(),
        voidTraceabilityEvent: jest.fn(),
      };
      const handler =
        name === 'create' ? createEvent : name === 'correct' ? correctEvent : voidEvent;
      const base = {
        request_key: '',
        payload: { schema_version: 1 },
        expected_revision: 1,
        reason: 'why',
        event_id: eventId,
      };
      await expect(handler(client as any, farmId, base)).rejects.toThrow();
      await expect(
        handler(client as any, farmId, { ...base, request_key: 'k'.repeat(201) }),
      ).rejects.toThrow();
      expect(client.createTraceabilityEvent).not.toHaveBeenCalled();
      expect(client.correctTraceabilityEvent).not.toHaveBeenCalled();
      expect(client.voidTraceabilityEvent).not.toHaveBeenCalled();
    }
  });
});

describe('stdio traceability report contract', () => {
  it('validates the advertised kind enum and forwards pagination', async () => {
    const client = { getTraceabilityReport: jest.fn().mockResolvedValue({ events: [] }) };
    await report(client as any, farmId, { kind: 'MOVEMENT', take: 25, skip: 50 });
    expect(client.getTraceabilityReport).toHaveBeenCalledWith(farmId, {
      kind: 'MOVEMENT',
      take: 25,
      skip: 50,
    });
  });

  it('rejects an unknown kind and malformed pagination before dispatch', async () => {
    const client = { getTraceabilityReport: jest.fn() };
    await expect(report(client as any, farmId, { kind: 'NOPE' })).rejects.toThrow();
    await expect(report(client as any, farmId, { take: 0 })).rejects.toThrow();
    await expect(report(client as any, farmId, { take: 101 })).rejects.toThrow();
    await expect(report(client as any, farmId, { skip: -1 })).rejects.toThrow();
    expect(client.getTraceabilityReport).not.toHaveBeenCalled();
  });

  it('advertises the matching kind enum and 1-100 pagination', () => {
    const tool = registerTools().find((entry) => entry.name === 'traceability_report');
    const properties = (tool?.inputSchema as any).properties;
    expect(properties.kind.enum).toEqual(
      expect.arrayContaining(['MOVEMENT', 'PURCHASE', 'SALE', 'DEATH', 'IDENTIFICATION']),
    );
    expect(properties.take).toMatchObject({ type: 'integer', minimum: 1, maximum: 100 });
    expect(properties.skip).toMatchObject({ type: 'integer', minimum: 0 });
  });
});

describe('stdio identifier-history contract', () => {
  it('trims a free-form type and value and forwards them', async () => {
    const client = { findIdentifierHistory: jest.fn().mockResolvedValue({ matches: [] }) };
    await findHistory(client as any, farmId, {
      value: '  BASELINE-1  ',
      type: '  CUSTOM-TYPE  ',
    });
    expect(client.findIdentifierHistory).toHaveBeenCalledWith(farmId, {
      value: 'BASELINE-1',
      type: 'CUSTOM-TYPE',
      include_historical: undefined,
    });
  });

  it('matches the advertised value/type length limits', async () => {
    const client = { findIdentifierHistory: jest.fn() };
    await expect(findHistory(client as any, farmId, { value: 'x'.repeat(129) })).rejects.toThrow();
    await expect(findHistory(client as any, farmId, { value: '' })).rejects.toThrow();
    await expect(
      findHistory(client as any, farmId, { value: 'ok', type: 't'.repeat(51) }),
    ).rejects.toThrow();
    expect(client.findIdentifierHistory).not.toHaveBeenCalled();
  });
});
