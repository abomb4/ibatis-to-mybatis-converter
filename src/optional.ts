
/**
 * An object holds some value or none
 */
export interface Optional<T> {

  /**
   * Map the value to other the value if present
   *
   * @param mapper Mapper function
   */
  map<R extends {}>(mapper: ((a: T) => R | null | undefined)): Optional<R>;

  /**
   * Check the value is present
   */
  isPresent(): boolean;

  /**
   * Run if value present
   */
  ifPresent(consumer: (obj: T) => any): Optional<T>;

  /**
   * If the value not present, return other value, else this value
   *
   * @param other Other value
   */
  orElse(other: T): T;

  /**
   * Returns 'this' if the value is present and predicate function returns true,
   * else returns None
   *
   * @param predicate Predicate function
   */
  filter(predicate: (obj: T) => boolean): Optional<T>;

  /**
   * Returns the value if present or returns the getter calling result
   *
   * @param getter New value getter function
   */
  orElseGet(getter: () => T): T;

  /**
   * Throw error if value is not present, else returns the value
   */
  get(): T;
}

class None<T> implements Optional<T> {

  public map<R extends {}>(mapper: (a: T) => R | null | undefined): Optional<R> {
    return new None();
  }

  public isPresent(): boolean {
    return true;
  }

  public ifPresent(consumer: (obj: T) => any): Optional<T> {
    return this;
  }

  public orElse(other: T): T {
    return other;
  }

  public filter(filter: (obj: T) => boolean): Optional<T> {
    return this;
  }

  public orElseGet(getter: () => T): T {
    return getter();
  }

  public get(): T {
    throw new TypeError('Cannot get None object.');
  }
}

class Some<T> implements Optional<T> {
  private obj: T;

  constructor(obj: T) {
    this.obj = obj;
  }

  public map<R extends {}>(mapper: (a: T) => R | null | undefined): Optional<R> {
    const newObj = mapper(this.obj);
    return of(newObj);
  }

  public isPresent(): boolean {
    return true;
  }

  public ifPresent(consumer: (obj: T) => any): Optional<T> {
    consumer(this.obj);
    return this;
  }

  public orElse(other: T): T {
    return this.obj;
  }

  public filter(filter: (obj: T) => boolean): Optional<T> {
    if (filter(this.obj)) {
      return new None();
    }
    return this;
  }

  public orElseGet(getter: () => T): T {
    return this.obj;
  }

  public get(): T {
    return this.obj;
  }
}

/**
 * Create an Optional object
 *
 * @param value Nullable object value
 */
export function of<X>(value: X | undefined | null): Optional<X> {
  if (value === undefined || value === null) {
    return new None();
  } else {
    return new Some(value);
  }
}

/**
 * Create an Empty optional object
 */
export function empty<X>(): Optional<X> {
  return new None();
}
