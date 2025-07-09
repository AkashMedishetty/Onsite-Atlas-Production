const express=require('express');
const router=express.Router({mergeParams:true});
const { protect, restrict } = require('../middleware/auth.middleware');
const ctrl=require('../controllers/workshop.controller');

router.route('/')
  .get(protect, restrict('admin','staff'), ctrl.listWorkshops)
  .post(protect, restrict('admin','staff'), ctrl.createWorkshop);

router.route('/:workshopId')
  .put(protect, restrict('admin','staff'), ctrl.updateWorkshop)
  .delete(protect, restrict('admin','staff'), ctrl.deleteWorkshop);

module.exports=router; 