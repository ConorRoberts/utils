import {
  createStorage as createUnstorage,
  type Storage,
  type StorageValue,
} from "unstorage";
import redisDriver, { type RedisOptions } from "unstorage/drivers/redis";

export class Cache {
  private _cache: Storage<StorageValue>;

  constructor(args: RedisOptions) {
    this._cache = createUnstorage({
      driver: redisDriver(args),
    });
  }

  get cache() {
    return this._cache;
  }

  public ttl(date: Date) {
    return Math.floor((date.getTime() - Date.now()) / 1000);
  }
}
