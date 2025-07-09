const express=require('express');
const router=express.Router({mergeParams:true});
const { protect, restrict } = require('../middleware/auth.middleware');
const ctrl=require('../controllers/pricingRule.controller');

router.route('/')
  .get(protect, restrict('admin','staff'), ctrl.listRules)
  .post(protect, restrict('admin','staff'), ctrl.createRule);

router.route('/:ruleId')
  .put(protect, restrict('admin','staff'), ctrl.updateRule)
  .delete(protect, restrict('admin','staff'), ctrl.deleteRule);

router.route('/bulk')
  .post(protect, restrict('admin','staff'), ctrl.bulkSaveRules);

module.exports=router; 