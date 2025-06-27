import { useEffect, useState, useCallback } from 'react';
import { Card, Spinner, Alert, Button, Modal, Pagination, Input } from '../../../components/common';
import { Table, Space, Tag, Tooltip, message } from 'antd';
import { SearchOutlined, ExportOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import authorService from '../../../services/authorService';
import abstractService from '../../../services/abstractService';

const { Column } = Table;

const AuthorsTab = ({ eventId }) => {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10, totalPages: 1, totalCount: 0 });
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [authorAbstracts, setAuthorAbstracts] = useState([]);
  const [abstractLoading, setAbstractLoading] = useState(false);
  const [totalPendingProofs, setTotalPendingProofs] = useState(0);

  const fetchAuthors = useCallback(async (page = 1, limit = 10, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      const res = await authorService.getAuthors(eventId, params);
      if (res.data.success) {
        setAuthors(res.data.data);
        const pag = res.data.pagination || {};
        setPagination({
          currentPage: Number(pag.page) || 1,
          pageSize: Number(pag.limit) || limit,
          totalCount: Number(pag.total) || 0,
          totalPages: Number(pag.totalPages) || 1
        });
        // compute total pending proofs across all authors
        const pending = (res.data.data || []).reduce((acc,a)=>acc+(a.pendingProofCount||0),0);
        setTotalPendingProofs(pending);
      } else throw new Error(res.data.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { if (eventId) fetchAuthors(1, pagination.pageSize, searchTerm); }, [eventId]);

  const handleSearch = () => fetchAuthors(1, pagination.pageSize, searchTerm);

  const handlePageChange = (page) => fetchAuthors(page, pagination.pageSize, searchTerm);

  const handlePageSizeChange = (size) => fetchAuthors(1, size, searchTerm);

  const handleExport = async () => {
    try {
      const res = await authorService.exportAuthors(eventId, { search: searchTerm });
      if (res && res.data instanceof Blob) {
        const url = window.URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.filename||`authors_${eventId}.csv`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      }
    } catch (e) {
      message.error(`Export failed: ${e.message}`);
    }
  };

  const openDetail = async (author) => {
    setSelectedAuthor(author);
    setDetailModalOpen(true);
    setAbstractLoading(true);
    try {
      const res = await abstractService.getAbstracts(eventId, { author: author._id }, 'admin');
      if (res.success) setAuthorAbstracts(res.data || []);
      else throw new Error(res.message);
    } catch (e) {
      message.error(`Failed to load abstracts: ${e.message}`);
      setAuthorAbstracts([]);
    } finally {
      setAbstractLoading(false);
    }
  };

  const handleVerifyProof = async (abstractId)=>{
    try{
      await abstractService.verifyRegistrationProof(eventId, abstractId);
      message.success('Registration verified');
      // refresh abstracts list in modal
      if(selectedAuthor) openDetail(selectedAuthor);
      // refresh main authors list to update pending counts
      fetchAuthors(pagination.currentPage, pagination.pageSize, searchTerm);
    }catch(e){
      message.error(e.message||'Verification failed');
    }
  };

  // helper to build absolute URL for uploads
  const buildFileUrl = (relUrl)=>{
    if(!relUrl) return '#';
    if(relUrl.startsWith('http')) return relUrl;
    const apiBase = import.meta.env.VITE_API_URL || '';
    // strip /api at end if present
    const base = apiBase.replace(/\/api$/, '');
    return `${base}${relUrl}`;
  };

  if (loading) return <Spinner />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div className="space-y-4">
      {/* Banner for pending proof approvals */}
      {totalPendingProofs>0 && (
        <Alert variant="warning" title="Registration proofs awaiting approval" description={`${totalPendingProofs} abstract${totalPendingProofs>1?'s are':' is'} waiting for admin verification.`} />
      )}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Input placeholder="Search name / email" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} prefix={<SearchOutlined />} />
          <Button variant="primary" onClick={handleSearch}>Search</Button>
        </div>
        <Button variant="outline" leftIcon={<ExportOutlined />} onClick={handleExport}>Export</Button>
      </div>

      <Card>
        <Table dataSource={authors} rowKey="_id" pagination={false} size="middle" scroll={{ x: true }}>
          <Column title="Name" dataIndex="name" key="name" render={(text, record)=> (
            <span className="text-blue-600 hover:underline cursor-pointer" onClick={()=>openDetail(record)}>{text}</span>
          )} />
          <Column title="Email" dataIndex="email" key="email" />
          <Column title="Mobile" dataIndex="mobile" key="mobile" />
          <Column title="Total" dataIndex="totalAbstracts" key="total" align="center" />
          <Column title="Submitted" key="submitted" align="center" render={(_, r) => r.statusCounts?.submitted || 0} />
          <Column title="Under Review" key="under" align="center" render={(_, r) => r.statusCounts?.['under-review'] || 0} />
          <Column title="Approved" key="approved" align="center" render={(_, r) => r.statusCounts?.approved || 0} />
          <Column title="Rejected" key="rejected" align="center" render={(_, r) => r.statusCounts?.rejected || 0} />
          <Column title="Reg-Proof" key="proofStatus" align="center" render={(_, r) => {
            if (!r.proofRequired) return <Tag color="default">N/A</Tag>;
            if (r.pendingProofCount && r.pendingProofCount > 0) return <Tag color="orange">Pending</Tag>;
            if (r.proofVerified) return <Tag color="green">Verified</Tag>;
            return <Tag color="orange">Pending</Tag>; // required but no upload yet
          }} />
          <Column
            title="Actions"
            key="actions"
            align="center"
            render={(_, record) => (
              <Space>
                <Tooltip title="Details"><EyeOutlined onClick={() => openDetail(record)} style={{ cursor: 'pointer' }} /></Tooltip>
                {record.pendingProofCount>0 && (
                  <Tooltip title="View pending proofs">
                    <CheckOutlined style={{ color:'#fa8c16', cursor:'pointer' }} onClick={()=>openDetail(record)} />
                  </Tooltip>
                )}
              </Space>
            )}
          />
        </Table>
      </Card>

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {selectedAuthor && (
        <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={`Author Details – ${selectedAuthor.name}`} centered={true} size="2xl"> 
          <div className="space-y-4">
            {/* Author basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">Name:</span> {selectedAuthor.name}</div>
              <div><span className="font-medium">Email:</span> {selectedAuthor.email}</div>
              <div><span className="font-medium">Mobile:</span> {selectedAuthor.mobile||'—'}</div>
              <div><span className="font-medium">Total Abstracts:</span> {selectedAuthor.totalAbstracts}</div>
              <div><span className="font-medium">Submitted:</span> {selectedAuthor.statusCounts?.submitted||0}</div>
              <div><span className="font-medium">Under-review:</span> {selectedAuthor.statusCounts?.['under-review']||0}</div>
              <div><span className="font-medium">Approved:</span> {selectedAuthor.statusCounts?.approved||0}</div>
              <div><span className="font-medium">Rejected:</span> {selectedAuthor.statusCounts?.rejected||0}</div>
            </div>

            {/* Abstracts list */}
            <h4 className="text-md font-semibold mt-4">Abstracts</h4>
            {abstractLoading ? <Spinner /> : (
              authorAbstracts.length === 0 ? <p className="text-center text-gray-500">No abstracts submitted.</p> : (
                <Table dataSource={authorAbstracts} rowKey="_id" pagination={false} size="small" scroll={{x:true}}
                   rowClassName={(rec)=> rec.registrationProofUrl && !rec.registrationVerified ? 'bg-orange-50' : ''}
                >
                  <Column title="#" render={(_,__,i)=>i+1} width={50} />
                  <Column title="ID" dataIndex="abstractNumber" key="absNo" width={120} />
                  <Column title="Title" dataIndex="title" key="title" />
                  <Column title="Status" dataIndex="status" key="status" render={s=> <Tag>{s}</Tag>} />
                  <Column title="Proof" key="proof" render={(_,r)=>{
                    if(!r.registrationProofUrl) return '—';
                    return (
                      <>
                        <a href={buildFileUrl(r.registrationProofUrl)} target="_blank" rel="noreferrer" className="text-primary-600 underline mr-2">View</a>
                        {!r.registrationVerified && <Tag color="orange">Pending</Tag>}
                        {r.registrationVerified && <Tag color="green">Verified</Tag>}
                      </>
                    );
                  }} />
                  <Column title="Reg. Verified" key="regv" render={(_,r)=>(r.registrationVerified? 'Yes':'No')} />
                  <Column title="Final Status" dataIndex="finalStatus" key="fstat" />
                  <Column title="Final" key="final" render={(_,r)=> r.finalFileUrl ? <a href={buildFileUrl(r.finalFileUrl)} target="_blank" rel="noreferrer">View</a> : '—'} />
                  <Column title="Actions" key="act" render={(_,rec)=>(
                    rec.registrationProofUrl && !rec.registrationVerified ? (
                      <Tooltip title="Verify Registration">
                        <Button size="xs" variant="success" leftIcon={<CheckOutlined className="h-3 w-3" />} onClick={()=>handleVerifyProof(rec._id)}>
                          Verify
                        </Button>
                      </Tooltip>
                    ) : null
                  )}/>
                </Table>
              )
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AuthorsTab; 