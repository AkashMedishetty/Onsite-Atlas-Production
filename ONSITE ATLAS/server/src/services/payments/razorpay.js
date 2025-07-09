const gstPct = this.event.paymentConfig?.extra?.gstPercentage || 0;
const orderOptions = {
  amount: amountCents,
  currency: 'INR',
  receipt: `reg_${registration._id}`,
};
if(gstPct){ orderOptions.tax_amount = Math.round(amountCents*gstPct/100); } 