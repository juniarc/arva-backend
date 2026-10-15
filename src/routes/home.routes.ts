import { Router } from 'express';
import { homeController } from '../controllers/home.controller.js';

export const homeRouter = Router();

homeRouter.get('/', homeController.getHome);
