import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FireHydrant } from './entities/fire-hydrant.entity';
import { BfpStation } from './entities/bfp-station.entity';

@Injectable()
export class MapAssetsService {
  constructor(
    @InjectRepository(FireHydrant)
    private hydrantsRepo: Repository<FireHydrant>,
    @InjectRepository(BfpStation)
    private stationsRepo: Repository<BfpStation>,
  ) {}

  // --- Hydrants ---
  findAllHydrants() {
    return this.hydrantsRepo.find({ order: { name: 'ASC' } });
  }

  async createHydrant(data: Partial<FireHydrant>) {
    const h = this.hydrantsRepo.create(data);
    return this.hydrantsRepo.save(h);
  }

  async updateHydrant(id: number, data: Partial<FireHydrant>) {
    const h = await this.hydrantsRepo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Hydrant not found');
    Object.assign(h, data);
    return this.hydrantsRepo.save(h);
  }

  async removeHydrant(id: number) {
    const h = await this.hydrantsRepo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Hydrant not found');
    return this.hydrantsRepo.remove(h);
  }

  // --- BFP Stations ---
  findAllStations() {
    return this.stationsRepo.find({ order: { name: 'ASC' } });
  }

  async createStation(data: Partial<BfpStation>) {
    const s = this.stationsRepo.create(data);
    return this.stationsRepo.save(s);
  }

  async updateStation(id: number, data: Partial<BfpStation>) {
    const s = await this.stationsRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Station not found');
    Object.assign(s, data);
    return this.stationsRepo.save(s);
  }

  async removeStation(id: number) {
    const s = await this.stationsRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Station not found');
    return this.stationsRepo.remove(s);
  }
}
