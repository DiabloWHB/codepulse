import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, TypedEventBus } from '../../../src/core/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('on/emit', () => {
    it('should call listener when event is emitted', () => {
      const callback = vi.fn();
      bus.on('test', callback);

      bus.emit('test', { value: 42 });

      expect(callback).toHaveBeenCalledWith({ value: 42 });
    });

    it('should support multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.on('test', callback1);
      bus.on('test', callback2);
      bus.emit('test', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = bus.on('test', callback);

      unsubscribe();
      bus.emit('test', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should only call listener once', () => {
      const callback = vi.fn();
      bus.once('test', callback);

      bus.emit('test', 'first');
      bus.emit('test', 'second');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });
  });

  describe('off', () => {
    it('should remove all listeners for event', () => {
      const callback = vi.fn();
      bus.on('test', callback);

      bus.off('test');
      bus.emit('test', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.on('event1', callback1);
      bus.on('event2', callback2);

      bus.clear();
      bus.emit('event1', 'data');
      bus.emit('event2', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return correct count', () => {
      bus.on('test', () => {});
      bus.on('test', () => {});

      expect(bus.listenerCount('test')).toBe(2);
      expect(bus.listenerCount('other')).toBe(0);
    });
  });
});

describe('TypedEventBus', () => {
  it('should work with typed events', () => {
    const bus = new TypedEventBus();
    const callback = vi.fn();

    bus.on('analysis:started', callback);
    bus.emit('analysis:started', { file: '/test.ts' });

    expect(callback).toHaveBeenCalledWith({ file: '/test.ts' });
  });
});
