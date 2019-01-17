import {UnauthorizedException, UseGuards} from '@nestjs/common';
import {Args, Mutation, Query, Resolver, Subscription} from '@nestjs/graphql';
import {PubSub} from 'graphql-subscriptions';
import {Home, HomeFavorite} from '../graphql.schema';
import {HomeService} from './home.service';
import {CreateHomeDto, DeleteHomeDto, UpdateHomeDto} from './dto';
import {AttomDataApiService} from './attom-data-api.service';
import {GraphqlGuard} from '../_helpers';
import {User as CurrentUser} from '../_helpers/graphql/user.decorator';
import {UserEntity as User} from '../user/entity/user.entity';

const pubSub = new PubSub();

@Resolver('Home')
@UseGuards(GraphqlGuard)
export class HomeResolvers {
	constructor(private readonly homeService: HomeService,
							private readonly attomDataService: AttomDataApiService) {
	}

	@Query('listHomes')
	async findAll(): Promise<HomeFavorite[]> {
		return this.homeService.findAll();
	}

	@Query('getHome')
	async findOneById(@Args('id') id: string): Promise<Home> {
		return await this.homeService.findOneById(id);
	}

	@Mutation('createHome')
	async create(@CurrentUser() user: User, @Args('createHomeInput') args: CreateHomeDto): Promise<Home> {
		const response = await this.attomDataService.getAVMDetail({address1: args.address_1, address2: args.address_2});
		args.json = JSON.stringify(response.data);
		args.owner = user.id;
		const createdHome = await this.homeService.create(args);
		pubSub.publish('homeCreated', {homeCreated: createdHome});
		return createdHome;
	}

	@Mutation('deleteHome')
	async delete(@CurrentUser() user: User, @Args('deleteHomeInput') args: DeleteHomeDto): Promise<Home> {
		const homeToDelete: Home = await this.homeService.findOneById(args.id);
		if (homeToDelete.owner === user.id) {
			const deletedHome = await this.homeService.delete(args.id);
			pubSub.publish('homeDeleted', {homeDeleted: deletedHome});
			return deletedHome;
		} else {
			throw new UnauthorizedException();
		}
	}

	@Mutation('updateHome')
	async update(@CurrentUser() user: User, @Args('updateHomeInput') args: UpdateHomeDto): Promise<Home> {
		const homeToUpdate: Home = await this.homeService.findOneById(args.id);
		if (homeToUpdate.owner === user.id) {
			args.owner = user.id;
			const updatedHome = await this.homeService.update(args);
			pubSub.publish('homeUpdated', {homeUpdated: updatedHome});
			return updatedHome;
		} else {
			throw new UnauthorizedException();
		}
	}

	@Subscription('homeCreated')
	homeCreated() {
		return {
			subscribe: () => pubSub.asyncIterator('homeCreated')
		};
	}
}
