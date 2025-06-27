const AuthorUser = require('../models/AuthorUser');
const asyncHandler = require('../middleware/async');
const mongoose = require('mongoose');
const { Parser: CsvParser } = require('json2csv');
const { sendPaginated } = require('../utils/pagination');
const Event = require('../models/Event');

const buildAggregatePipeline = (eventId, search) => {
  const eventObjId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : null;
  const match = {
    $or: [ { event: eventId }, ...(eventObjId ? [{ event: eventObjId }] : []) ]
  };
  if (search) {
    match.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } }
    ];
  }

  return [
    { $match: match },
    {
      $lookup: {
        from: 'abstracts',
        let: { authorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$author', '$$authorId'] } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        as: 'abstractStats'
      }
    },
    {
      $lookup: {
        from: 'abstracts',
        let: { authorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$author', '$$authorId'] } } },
          {
            $match: {
              $and: [
                { registrationProofUrl: { $ne: null } },
                { registrationVerified: { $eq: false } }
              ]
            }
          },
          { $project: { _id: 1 } }
        ],
        as: 'pendingProofs'
      }
    },
    {
      $lookup: {
        from: 'abstracts',
        let: { authorId: '$_id', evtId: eventObjId },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$author', '$$authorId'] },
                  { $eq: ['$event', '$$evtId'] }
                ]
              }
            }
          },
          { $match: { status: { $in: ['accepted', 'approved'] } } },
          { $project: { _id: 1, registrationVerified: 1, registrationProofUrl: 1 } }
        ],
        as: 'acceptedAbstracts'
      }
    },
    {
      $addFields: {
        totalAbstracts: { $sum: '$abstractStats.count' },
        statusCounts: {
          $arrayToObject: {
            $map: {
              input: '$abstractStats',
              as: 'stat',
              in: ['$$stat._id', '$$stat.count']
            }
          }
        },
        pendingProofCount: {
          $size: {
            $filter: {
              input: '$acceptedAbstracts',
              as: 'a',
              cond: {
                $and: [
                  { $ne: ['$$a.registrationVerified', true] },
                  { $ne: ['$$a.registrationProofUrl', null] }
                ]
              }
            }
          }
        },
        hasPendingProof: { $gt: [{ $size: '$pendingProofs' }, 0] },
        proofRequired: { $gt: [ { $size: '$acceptedAbstracts' }, 0 ] },
        proofVerified: {
          $eq: [
            {
              $size: {
                $filter: {
                  input: '$acceptedAbstracts',
                  as: 'a',
                  cond: { $eq: ['$$a.registrationVerified', false] }
                }
              }
            },
            0
          ]
        }
      }
    },
    { $project: { passwordHash: 0, __v: 0, abstractStats: 0, pendingProofs: 0, acceptedAbstracts: 0 } }
  ];
};

exports.getAuthors = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, limit = 10, search } = req.query;

  const pipeline = buildAggregatePipeline(eventId, search);

  const searchMatch = search ? {
    event: eventId,
    $or: [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } }
    ]
  } : { event: eventId };

  const totalAuthors = await AuthorUser.countDocuments(searchMatch);

  const authors = await AuthorUser.aggregate([
    ...pipeline,
    { $sort: { createdAt: -1 } },
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) }
  ]);

  return sendPaginated(res, {
    data: authors,
    page: Number(page),
    limit: Number(limit),
    total: totalAuthors,
    message: 'Authors retrieved'
  });
});

exports.exportAuthors = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { search } = req.query;

  // Aggregate starting from Abstracts to guarantee rows
  const Abstract = mongoose.model('Abstract');
  const eventObjId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : null;
  const match = {
    $or: [ { event: eventId }, ...(eventObjId ? [{ event: eventObjId }] : []) ]
  };
  if (search) {
    match.$expr = {
      $regexMatch: {
        input: '$$ROOT.title',
        regex: search,
        options: 'i'
      }
    };
  }

  const rows = await Abstract.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'authorusers',
        localField: 'author',
        foreignField: '_id',
        as: 'authorDoc'
      }
    },
    { $unwind: '$authorDoc' },
    {
      $project: {
        authorName: '$authorDoc.name',
        authorEmail: '$authorDoc.email',
        authorMobile: '$authorDoc.mobile',
        abstractId: { $toString: '$_id' },
        abstractNumber: '$abstractNumber',
        abstractTitle: '$title',
        status: '$status',
        registrationVerified: { $cond: ['$registrationVerified', 'Yes', 'No'] },
        finalStatus: '$finalStatus'
      }
    }
  ]);

  console.log(`[exportAuthors] Event ${eventId}: generated ${rows.length} rows for CSV export.`);
  if (rows.length > 0) {
    console.log('[exportAuthors] First row sample:', rows[0]);
  }

  const event = await Event.findById(eventId).select('name');
  const eventSlug = event && event.name ? event.name.replace(/[^a-z0-9]+/gi,'_').toLowerCase() : eventId;

  const fields = [
    { label: 'Author Name', value: 'authorName' },
    { label: 'Author Email', value: 'authorEmail' },
    { label: 'Author Mobile', value: 'authorMobile' },
    { label: 'Abstract ID', value: 'abstractId' },
    { label: 'Abstract Number', value: 'abstractNumber' },
    { label: 'Title', value: 'abstractTitle' },
    { label: 'Current Status', value: 'status' },
    { label: 'Registration Verified', value: 'registrationVerified' },
    { label: 'Final File Status', value: 'finalStatus' }
  ];

  const parser = new CsvParser({ fields });
  const csv = parser.parse(rows);

  res.header('Content-Type', 'text/csv');
  res.set('Cache-Control', 'no-store');
  res.attachment(`authors_${eventSlug}.csv`);
  return res.send(csv);
}); 