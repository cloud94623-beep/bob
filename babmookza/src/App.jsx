import React, { useState, useEffect } from 'react';
import './App.css'; // 작성해둔 CSS 불러오기
import { db } from './firebase'; // 방금 만든 파이어베이스 창고 연결 파이프라인 불러오기
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const DEFAULT_ROOMS = [];
const DEFAULT_DEV_RESERVATIONS = [];
const DEV_UNAVAILABLE_DAYS = [];

const getDaysInMonthArray = (year, month) => {
  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  });
};

const getMonthStartOffsetGap = (year, month) => {
  return new Date(year, month - 1, 1).getDay();
};

function App() {
  const [usersDatabase, setUsersDatabase] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [devReservations, setDevReservations] = useState([]);

  // 접속한 사람의 세션 정보는 각자 브라우저에 유지되어야 하므로 localStorage 유지
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bmz_session_v15')) || null; } 
    catch(e) { return null; }
  });

  const [view, setView] = useState(currentUser ? 'dashboard' : 'login');
  const [loginName, setLoginName] = useState('');
  const [loginBirth, setLoginBirth] = useState('');

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [tempRoomData, setTempRoomData] = useState(null);
  const [creatorInitialOpinion, setCreatorFirstOpinion] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [scheduleTab, setScheduleTab] = useState('input');
  const [inputSelectedDates, setInputSelectedDates] = useState([]); 
  const [checkSingleDate, setCheckSelectedDate] = useState(''); 
  const [devSelectedDate, setDevSelectedDate] = useState('');
  const [devBlockMemo, setDevBlockMemo] = useState('');
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6);
  
  const [unlockedBookingIds, setUnlockedBookingIds] = useState([]);
  const [guestOpinion, setGuestOpinion] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState(null);
  
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showUserList, setShowUserList] = useState(false);

  const isDeveloper = currentUser?.id === '개발자#4475';

  // ✨ [핵심 변경] 구글 클라우드 창고(Firestore)와 실시간 동기화 파이프라인 연결
  useEffect(() => {
    localStorage.setItem('bmz_session_v15', JSON.stringify(currentUser));
    if (view !== 'dashboard' && view !== 'dev-lunch-intro') {
      setShowUserList(false);
    }
  }, [currentUser, view]);

  useEffect(() => {
    // 1. 유저 리스트 실시간 동기화
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data());
      setUsersDatabase(usersData);
    });

    // 2. 모임 방 리스트 실시간 동기화
    const unsubscribeRooms = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const roomsData = snapshot.docs.map(doc => doc.data());
      setRooms(roomsData);
    });

    // 3. 개발자 예약 리스트 실시간 동기화
    const unsubscribeDevRes = onSnapshot(collection(db, "devReservations"), (snapshot) => {
      const devResData = snapshot.docs.map(doc => doc.data());
      setDevReservations(devResData);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeRooms();
      unsubscribeDevRes();
    };
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimName = loginName.trim();
    const trimBirth = loginBirth.trim();

    if(!trimName || trimBirth.length !== 4 || isNaN(trimBirth)) {
      triggerToast("이름과 생일 4자리(예: 0623)를 입력해주세요.");
      return;
    }

    const userId = `${trimName}#${trimBirth}`;
    const existingUser = usersDatabase.find(u => u.name === trimName);
    
    let successMsg = `환영합니다, ${trimName}님!`;
    if (trimName === '개발자' && trimBirth === '4475') {
        successMsg = "개발자 마스터 계정으로 로그인되었습니다.";
    } else {
        const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
        const isBirthday = trimBirth.substring(0, 2) === currentMonthStr;
        if (isBirthday) successMsg = `${trimName}님! 생일 축하합니다~!`;
    }

    if (existingUser) {
      if (existingUser.birth !== trimBirth) {
        triggerToast("입력하신 이름과 생일 정보가 다릅니다. 다시 확인해주세요.");
        return;
      }
      triggerToast(successMsg);
    } else {
      // 새로운 멤버 구글 창고에 등록
      const newUser = { id: userId, name: trimName, birth: trimBirth };
      await setDoc(doc(db, "users", userId), newUser);
      triggerToast(successMsg + " (새로운 멤버 등록)");
    }

    setCurrentUser({ id: userId, name: trimName, birth: trimBirth });
    setView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setLoginName('');
    setLoginBirth('');
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  const handleCreateRoomSubmit = (e) => {
    e.preventDefault();
    if (!newRoomTitle.trim() || !newRoomPassword.trim()) {
      triggerToast("모임 이름과 비밀번호를 모두 기재해 주십시오.");
      return;
    }
    if (newRoomPassword.length !== 4 || isNaN(newRoomPassword)) {
      triggerToast("비밀번호는 숫자 4자리로 설정해 주세요.");
      return;
    }
    setTempRoomData({
      title: newRoomTitle,
      password: newRoomPassword
    });
    setSelectedDates([]);
    setView('select-dates');
  };

  const handleFinalizeRoom = async () => {
    if (selectedDates.length === 0) {
      triggerToast("식사를 희망하시는 날짜를 캘린더에서 최소 하나 선택하세요.");
      return;
    }
    const newCode = 'BMZ-' + Math.floor(1000 + Math.random() * 9000);
    const roomOpinion = creatorInitialOpinion.trim() || "없음";
    
    const newRoom = {
      id: newCode,
      title: tempRoomData.title,
      password: tempRoomData.password,
      creatorId: currentUser.id,
      dates: selectedDates,
      participants: [
        { id: currentUser.id, name: currentUser.name, dates: selectedDates, comment: roomOpinion }
      ]
    };

    // 구글 창고(Firestore)의 'rooms' 컬렉션에 업로드
    await setDoc(doc(db, "rooms", newCode), newRoom);

    setCreatedRoomCode(newCode);
    setView('room-success');
    
    setNewRoomTitle('');
    setNewRoomPassword('');
    setCreatorFirstOpinion('');
  };

  const handleJoinRoomSubmit = async (e) => {
    e.preventDefault();
    const cleanJoinCode = joinCode.trim().replace(/-/g, '').toUpperCase();
    const targetRoom = rooms.find(r => r.id.replace(/-/g, '') === cleanJoinCode);
    
    if (!targetRoom) {
      triggerToast("존재하지 않는 코드입니다.");
      return;
    }
    if (targetRoom.password !== joinPassword) {
      triggerToast("비밀번호가 일치하지 않습니다.");
      return;
    }

    const isAlreadyPart = targetRoom.participants.some(p => p.id === currentUser.id);
    
    if (!isAlreadyPart) {
      const updatedParticipants = [...targetRoom.participants, { id: currentUser.id, name: currentUser.name, dates: [], comment: "없음" }];
      // 구글 창고 데이터 실시간 업데이트
      await updateDoc(doc(db, "rooms", targetRoom.id), { participants: updatedParticipants });
    }
    
    setSelectedRoomId(targetRoom.id);
    setScheduleTab('input'); 
    setView('view-schedule');
    setJoinCode('');
    setJoinPassword('');
    
    if (targetRoom.dates.length > 0) {
      const [rYear, rMonth] = targetRoom.dates[0].split('-');
      setCurrentYear(parseInt(rYear));
      setCurrentMonth(parseInt(rMonth));
    }
  };

  const handleGuestJoinSubmit = async (guestSelectedDates, opinionText) => {
    if (guestSelectedDates.length === 0) {
      triggerToast("참가할 날짜를 최소 하나 이상 선택해주세요.");
      return;
    }
    
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    if (!targetRoom) return;

    const existingIndex = targetRoom.participants.findIndex(p => p.id === currentUser.id);
    let updatedParticipants = [...targetRoom.participants];
    const opinionComment = opinionText.trim() || "없음";
    
    if (existingIndex > -1) {
      updatedParticipants[existingIndex] = { 
        id: currentUser.id,
        name: currentUser.name, 
        dates: guestSelectedDates,
        comment: opinionComment
      };
    } else {
      updatedParticipants.push({ 
        id: currentUser.id,
        name: currentUser.name, 
        dates: guestSelectedDates,
        comment: opinionComment
      });
    }

    // 구글 창고 데이터 실시간 업데이트
    await updateDoc(doc(db, "rooms", selectedRoomId), { participants: updatedParticipants });
    triggerToast(`내 일정이 업데이트 되었습니다.`);
  };

  const handleLeaveRoom = async (roomId) => {
    const targetRoom = rooms.find(r => r.id === roomId);
    if (!targetRoom) return;

    const updatedParticipants = targetRoom.participants.filter(p => p.id !== currentUser.id);
    await updateDoc(doc(db, "rooms", roomId), { participants: updatedParticipants });
    triggerToast("내 대시보드에서 삭제되었습니다.");
  };

  const handleDevBookingSubmit = async (e) => {
    e.preventDefault();
    if (!devSelectedDate) {
      triggerToast("예약 일정을 달력에서 먼저 터치해 주십시오.");
      return;
    }

    const alreadyBooked = devReservations.some(res => res.date === devSelectedDate);
    if (alreadyBooked) {
      triggerToast("해당 날짜는 이미 예약되거나 블락되었습니다.");
      return;
    }

    const bookingId = 'dev-' + Date.now();
    const newBooking = {
      id: bookingId,
      date: devSelectedDate,
      userId: currentUser.id,
      nickname: currentUser.name,
      birth: currentUser.birth
    };

    // 개발자 예약 내역 구글 창고에 업로드
    await setDoc(doc(db, "devReservations", bookingId), newBooking);
    triggerToast("예약되었습니다.");
  };

  const handleMasterBlockDate = async () => {
    if (!devSelectedDate) {
      triggerToast("차단할 일자를 달력에서 먼저 터치해 주십시오.");
      return;
    }
    const alreadyBooked = devReservations.some(res => res.date === devSelectedDate);
    if (alreadyBooked) {
      triggerToast("이미 일정이 존재하는 일자입니다. 취소 후 실행하십시오.");
      return;
    }
    
    const bookingId = 'dev-block-' + Date.now();
    const forceBlock = {
      id: bookingId,
      date: devSelectedDate,
      userId: 'master-block',
      nickname: '개발자 휴무',
      birth: '4475',
      memo: devBlockMemo.trim() || '개인 일정으로 인한 불가'
    };
    
    await setDoc(doc(db, "devReservations", bookingId), forceBlock);
    triggerToast("해당 일자가 차단(블락)되었습니다.");
    setDevBlockMemo('');
  };

  const handleCancelDevBooking = async (bookingId) => {
    // 구글 창고에서 예약 도큐먼트 즉시 삭제
    await deleteDoc(doc(db, "devReservations", bookingId));
    triggerToast("해당 일정을 정상적으로 해제/취소 했습니다.");
  };

  const handleDeleteMemberCompletely = async () => {
    const targetName = prompt("초기화할 멤버의 '이름'을 정확히 입력하세요.\n(삭제 시 해당 멤버가 개설한 방과 모든 일정이 영구 삭제됩니다.)");
    if (targetName) {
      const targetUser = usersDatabase.find(u => u.name === targetName);
      if (targetUser) {
        // 1. 유저 데이터 삭제
        await deleteDoc(doc(db, "users", targetUser.id));
        
        // 2. 방 데이터 연쇄 삭제 및 업데이트
        rooms.forEach(async (room) => {
          if (room.creatorId === targetUser.id) {
            await deleteDoc(doc(db, "rooms", room.id));
          } else if (room.participants.some(p => p.id === targetUser.id)) {
            const filteredParticipants = room.participants.filter(p => p.id !== targetUser.id);
            await updateDoc(doc(db, "rooms", room.id), { participants: filteredParticipants });
          }
        });

        // 3. 개발자 예약 연쇄 삭제
        devReservations.forEach(async (res) => {
          if (res.userId === targetUser.id) {
            await deleteDoc(doc(db, "devReservations", res.id));
          }
        });

        triggerToast(`[${targetName}] 님의 모든 등록 정보가 초기화되었습니다.`);
      } else {
        triggerToast("해당 이름의 멤버를 데이터베이스에서 찾을 수 없습니다.");
      }
    }
  };

  const currentMonthDaysMatrix = getDaysInMonthArray(currentYear, currentMonth);
  const currentMonthOffsetGap = getMonthStartOffsetGap(currentYear, currentMonth);

  const getDotsForDate = (room, dateStr) => {
    if (!room) return [];
    return room.participants.filter(p => p.dates.includes(dateStr)).map(p => p.name);
  };

  const getParticipantsForDate = (room, dateStr) => {
    if (!room) return [];
    return room.participants.filter(p => p.dates.includes(dateStr));
  };

  const getMostPromisingDates = (room) => {
    if (!room || room.participants.length === 0) return [];
    
    const allSelectedDates = [];
    room.participants.forEach(p => {
      allSelectedDates.push(...p.dates);
    });
    
    const uniqueDates = [...new Set(allSelectedDates)];
    
    const dateCounts = [];
    uniqueDates.forEach(date => {
      const count = room.participants.filter(p => p.dates.includes(date)).length;
      dateCounts.push({ date, count });
    });
    
    dateCounts.sort((a, b) => b.count - a.count);
    const maxAttendance = dateCounts[0]?.count || 0;
    
    if (maxAttendance < 2) return [];
    
    return dateCounts.filter(dc => dc.count === maxAttendance);
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const promisingDates = selectedRoom ? getMostPromisingDates(selectedRoom) : [];

  const myRooms = currentUser ? rooms.filter(r => r.participants.some(p => p.id === currentUser.id)) : [];

  const roomToDelete = rooms.find(r => r.id === confirmDeleteRoomId);
  const isCreatorDelete = roomToDelete && currentUser && roomToDelete.creatorId === currentUser.id;

  return (
    <div className="w-full flex flex-col justify-between flex-grow relative bg-black">
      
      {/* NOTICE MODAL */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-[#111] border border-neutral-700 p-6 shadow-2xl w-full max-w-sm">
            <h3 className="text-[15px] text-white font-bold mb-3 border-b border-neutral-800 pb-3 uppercase font-luxury">BABMOOKZA Guide</h3>
            <div className="text-[12px] text-neutral-400 space-y-3 mb-6 leading-relaxed">
              <p>• <strong className="text-white">새로운 모임 개설:</strong> 새로운 모임을 만들고 코드를 공유하세요.</p>
              <p>• <strong className="text-white">코드로 입장:</strong> 전달받은 초대 코드로 약속에 합류하세요.</p>
              <p>• <strong className="text-white">개발자와의 1:1 식사:</strong> 개발자와의 식사 일정을 잡아보세요.</p>
              <p className="text-[10px] text-neutral-500 pt-3 border-t border-neutral-800 text-center">*본 서비스는 비밀번호는 아무거나 넣어도 로그인이 되지만 번호를 꼭 기억해주세요! </p>
            </div>
            <button onClick={() => setShowNoticeModal(false)} className="w-full py-3 bg-neutral-900 border border-neutral-700 text-white text-[14px] font-bold hover:bg-neutral-800 transition">닫기</button>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteRoomId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-[#111] border border-neutral-700 p-6 rounded-none shadow-2xl w-full max-w-sm text-center">
            <h3 className="text-[16px] text-white font-bold mb-2 tracking-wide">
              {isCreatorDelete ? '일정을 완전히 삭제하시겠습니까?' : '일정을 삭제하시겠습니까?'}
            </h3>
            <p className="text-[12px] text-neutral-400 mb-6 leading-relaxed">
              {isCreatorDelete 
                ? <span>방장 권한으로 일정을 삭제합니다.<br/>모든 참여자의 목록에서 방이 사라집니다.</span>
                : <span>이 작업은 내 대시보드 목록에서만 지워지며<br/>방 자체가 삭제되는 것은 아닙니다.</span>}
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setConfirmDeleteRoomId(null)} className="flex-1 py-3 bg-neutral-900 border border-neutral-700 text-white text-[14px] font-bold hover:bg-neutral-800 transition">아니오</button>
              <button onClick={async () => { 
                  if (isCreatorDelete) {
                    await deleteDoc(doc(db, "rooms", confirmDeleteRoomId));
                    triggerToast("일정이 완전히 삭제되었습니다.");
                  } else {
                    await handleLeaveRoom(confirmDeleteRoomId); 
                  }
                  setConfirmDeleteRoomId(null); 
                }} className="flex-1 py-3 bg-neutral-200 border border-white text-black text-[14px] font-bold hover:bg-white transition">예, 삭제합니다</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM ALERTER */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-[#111] border border-neutral-600 text-white px-6 py-4 shadow-2xl text-[14px] flex items-center justify-center tracking-wider font-semibold animate-pulse w-max max-w-[90%] text-center">
          <span>{toastMessage}</span>
        </div>
      )}

      <img src="/header.png" alt="Header" className="w-full h-auto block object-cover z-20 relative" />

      {/* VIEW 0: LOGIN SCREEN */}
      {view === 'login' && (
        <div className="flex flex-col flex-grow animate-fade-in bg-black">
          <div className="w-full relative z-0">
            <img src="/Plate.png" alt="Plate" className="w-full h-auto block" style={{ opacity: 0.9 }}/>
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none"></div>
          </div>
          
          <div className="flex flex-col px-6 pt-2 pb-8 relative z-10 w-full flex-grow">
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <input 
                type="text" 
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="이름" 
                className="premium-input rounded-sm"
              />
              <input 
                type="password" 
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                value={loginBirth}
                onChange={(e) => setLoginBirth(e.target.value)}
                placeholder="생일 4자리 (비밀번호)" 
                className="premium-input rounded-sm"
              />
              <button type="submit" className="w-full menu-btn rounded-sm mt-4">
                <div className="menu-btn-inner text-[18px]">접속하기</div>
              </button>
            </form>

            <div className="flex justify-end mt-auto pt-8">
              <button
                onClick={() => setShowNoticeModal(true)}
                className="w-10 h-10 rounded-full border border-neutral-700 bg-black/80 text-neutral-400 backdrop-blur flex items-center justify-center hover:text-white hover:border-white transition shadow-lg"
              >
                <span className="font-bold text-[14px]">?</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: DASHBOARD (HOME) */}
      {view === 'dashboard' && currentUser && (
        <div className="flex flex-col flex-grow animate-fade-in bg-gradient-to-b from-[#262626] via-[#050505] to-black">
          <div className="p-6 pb-4 flex justify-between items-end border-b border-neutral-900 bg-transparent">
            <div>
              <span className="text-[11px] text-neutral-400 font-bold tracking-widest uppercase block mb-1">My Dashboard</span>
              <h2 className="text-xl font-bold text-white">{currentUser.name} 님, 환영합니다.</h2>
            </div>
            <button onClick={handleLogout} className="text-[12px] text-neutral-500 hover:text-white font-bold transition">
              로그아웃
            </button>
          </div>

          <div className="p-6 space-y-8 flex-grow">
            <div className="grid grid-cols-2 gap-3 w-full">
              <button onClick={() => { setView('create-room'); setCurrentYear(2026); setCurrentMonth(6); }} className="bg-neutral-900 border border-neutral-700 py-3.5 px-4 text-center hover:bg-neutral-800 transition flex flex-col items-center justify-center">
                <span className="text-[14px] font-bold text-white tracking-wider">새 모임 만들기</span>
              </button>
              <button onClick={() => setView('join-room')} className="bg-[#111] border border-neutral-700 py-3.5 px-4 text-center hover:bg-[#222] transition flex flex-col items-center justify-center">
                <span className="text-[14px] font-bold text-neutral-300 tracking-wider">코드로 입장</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-neutral-400 tracking-widest uppercase">내가 참여 중인 일정</h3>
                <span className="text-[11px] bg-neutral-800 text-white px-2.5 py-0.5 rounded-full">{myRooms.length}</span>
              </div>

              {myRooms.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-neutral-800 p-6 text-center">
                  <p className="text-[13px] text-neutral-500 mb-3">아직 참여 중인 일정이 없습니다.</p>
                  <button onClick={() => setView('create-room')} className="text-[12px] text-white font-bold underline underline-offset-4 hover:text-neutral-300">첫 번째 모임을 만들어보세요</button>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {myRooms.map(room => (
                    <div key={room.id} className="group bg-[#0a0a0a] border border-neutral-800 p-4 hover:border-neutral-500 transition flex items-center justify-between">
                      <div className="cursor-pointer flex-grow" onClick={() => { setSelectedRoomId(room.id); setScheduleTab('input'); setView('view-schedule'); }}>
                        <span className="text-[10px] text-neutral-400 font-bold block mb-1 font-mono">{room.id}</span>
                        <h4 className="text-[15px] font-bold text-white group-hover:text-neutral-300 transition">{room.title}</h4>
                        <p className="text-[11px] text-neutral-500 mt-1">참여자 {room.participants.length}명</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(room.id); }} className="w-10 h-10 bg-neutral-900 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 border border-transparent transition flex-shrink-0 ml-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-neutral-900">
              <button onClick={() => { setView('dev-lunch-intro'); setCurrentYear(2026); setCurrentMonth(6); setDevSelectedDate(''); }} className="w-full bg-[#0a0a0a] border border-neutral-800 py-3.5 px-5 flex items-center justify-between hover:bg-neutral-900 transition">
                <div className="flex items-center space-x-3">
                  <div className="text-left">
                    <span className="text-[14px] font-bold text-white block">개발자와의 1:1 식사</span>
                    <span className="text-[11px] text-neutral-500">저랑도 먹어주세요 제발.</span>
                  </div>
                </div>
                <span className="text-neutral-400 text-sm font-bold">&gt;</span>
              </button>
            </div>

            {/* ★ 개발자 전용 제어판 UI */}
            {isDeveloper && (
              <div className="pt-4 animate-fade-in">
                <div className="bg-[#050505] border border-neutral-700 p-5 space-y-4 shadow-2xl relative">
                  <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                    <span className="text-[12px] uppercase tracking-widest text-white font-black">개발자 전용 제어판</span>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button onClick={handleDeleteMemberCompletely} className="w-full py-3 bg-[#111] border border-neutral-800 text-neutral-400 text-[13px] font-bold hover:bg-neutral-800 hover:text-white transition">
                      [1] 특정 멤버 완전 초기화
                    </button>
                    <button onClick={() => setShowUserList(!showUserList)} className="w-full py-3 bg-[#111] border border-neutral-800 text-neutral-400 text-[13px] font-bold hover:bg-neutral-800 hover:text-white transition">
                      [2] 가입 멤버 리스트 조회
                    </button>
                  </div>

                  {showUserList && (
                    <div className="mt-4 bg-black border border-neutral-800 p-4 max-h-48 overflow-y-auto animate-fade-in space-y-2">
                      <div className="text-[11px] text-neutral-500 font-bold border-b border-neutral-800 pb-2 mb-2 flex justify-between">
                        <span>이름</span>
                        <span>생일(비번)</span>
                      </div>
                      {usersDatabase.length > 0 ? (
                        usersDatabase.map(u => (
                          <div key={u.id} className="flex justify-between items-center text-[13px] text-neutral-300">
                            <span className="font-bold text-white">{u.name}</span>
                            <span className="font-mono text-neutral-500">{u.birth}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[12px] text-neutral-600 text-center py-2">등록된 멤버가 없습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OTHER VIEWS */}
      {view !== 'login' && view !== 'dashboard' && currentUser && (
        <div className="flex flex-col flex-grow bg-gradient-to-b from-[#262626] via-[#050505] to-black">
          <div className="p-6 flex-grow flex flex-col justify-between bg-transparent">
            
            {/* VIEW 2: CREATE MEETING ROOM */}
            {view === 'create-room' && (
              <div className="space-y-6 flex flex-col justify-between flex-grow">
                <div className="space-y-5">
                  <div className="flex items-center space-x-3 pb-3 border-b border-neutral-800">
                    <button onClick={() => setView('dashboard')} className="px-4 py-2 bg-[#111] border border-neutral-700 text-white hover:border-neutral-400 transition flex items-center justify-center">
                      <span className="text-[13px] font-bold font-luxury tracking-widest">BACK</span>
                    </button>
                    <div>
                      <h2 className="text-[16px] font-bold tracking-widest text-white uppercase">새 일정 만들기</h2>
                      <p className="text-[13px] text-neutral-500">시크릿 모임을 위해 암호를 설정해 주세요. </p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateRoomSubmit} className="space-y-5 flex flex-col bg-[#0a0a0a] p-6 border border-neutral-800">
                    <div className="flex flex-col space-y-2 w-full">
                      <label className="text-[12px] uppercase tracking-widest text-neutral-400 font-bold">모임 이름</label>
                      <input 
                        type="text" 
                        value={newRoomTitle}
                        onChange={(e) => setNewRoomTitle(e.target.value)}
                        placeholder="모임 이름을 작성해 주세요" 
                        className="premium-input text-[16px]"
                      />
                    </div>

                    <div className="flex flex-col space-y-2 w-full">
                      <label className="text-[12px] uppercase tracking-widest text-neutral-400 font-bold">비밀번호 (숫자 4자리)</label>
                      <input 
                        type="password" 
                        maxLength={4}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newRoomPassword}
                        onChange={(e) => setNewRoomPassword(e.target.value)}
                        placeholder="••••" 
                        className="premium-input text-[16px] font-mono tracking-[0.5em]"
                      />
                    </div>

                    <button type="submit" className="w-full menu-btn mt-6">
                      <div className="menu-btn-inner text-[18px]">캘린더로 이동</div>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* VIEW: JOIN ROOM BY CODE */}
            {view === 'join-room' && (
              <div className="space-y-6 flex flex-col justify-between flex-grow">
                <div className="space-y-5">
                  <div className="flex items-center space-x-3 pb-3 border-b border-neutral-800">
                    <button onClick={() => setView('dashboard')} className="px-4 py-2 bg-[#111] border border-neutral-700 text-white hover:border-neutral-400 transition flex items-center justify-center">
                      <span className="text-[13px] font-bold font-luxury tracking-widest">BACK</span>
                    </button>
                    <div>
                      <h2 className="text-[16px] font-bold tracking-widest text-white uppercase">모임 입장하기</h2>
                      <p className="text-[13px] text-neutral-500">전달받은 코드를 입력해 합류하세요.</p>
                    </div>
                  </div>

                  <form onSubmit={handleJoinRoomSubmit} className="space-y-5 flex flex-col bg-[#0a0a0a] p-6 border border-neutral-800">
                    <div className="flex flex-col space-y-2 w-full">
                      <label className="text-[12px] uppercase tracking-widest text-neutral-400 font-bold">초대 코드</label>
                      <input 
                        type="text" 
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="BMZ-XXXX" 
                        className="premium-input text-[16px] font-mono uppercase"
                      />
                    </div>

                    <div className="flex flex-col space-y-2 w-full">
                      <label className="text-[12px] uppercase tracking-widest text-neutral-400 font-bold">모임 비밀번호</label>
                      <input 
                        type="password" 
                        maxLength={4}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        placeholder="••••" 
                        className="premium-input text-[16px] font-mono tracking-[0.5em]"
                      />
                    </div>

                    <button type="submit" className="w-full menu-btn mt-6">
                      <div className="menu-btn-inner text-[18px]">입장하기</div>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* VIEW 3: SELECT DATES FOR THE TABLE */}
            {view === 'select-dates' && tempRoomData && (
              <div className="space-y-6 flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex items-center space-x-3 pb-3 border-b border-neutral-800">
                    <button onClick={() => setView('create-room')} className="p-2 px-3.5 bg-[#111] border border-neutral-700 text-neutral-300 font-bold hover:text-white transition">
                      <span className="text-[13px]">BACK</span>
                    </button>
                    <div>
                      <h2 className="text-[15px] font-bold tracking-widest text-white">{tempRoomData.title}</h2>
                      <p className="text-[12px] text-neutral-400">가능한 일자들을 다중 선택해 주세요</p>
                    </div>
                  </div>

                  <div className="bg-[#0a0a0a] p-5 border border-neutral-800 my-4 w-full">
                    <div className="relative flex justify-center items-center mb-4 w-full">
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <button onClick={handlePrevMonth} className="text-[14px] text-neutral-500 hover:text-white transition font-bold p-2">&lt;</button>
                        <div className="text-center text-[14px] sm:text-[15px] tracking-[0.1em] sm:tracking-[0.2em] font-luxury text-white font-bold uppercase w-[120px] sm:w-[140px]">
                          {new Date(currentYear, currentMonth - 1).toLocaleString('en-US', { month: 'long' })} {currentYear}
                        </div>
                        <button onClick={handleNextMonth} className="text-[14px] text-neutral-500 hover:text-white transition font-bold p-2">&gt;</button>
                      </div>
                      <button 
                        onClick={handleGoToday} 
                        className="absolute right-0 text-[9px] sm:text-[10px] font-luxury font-bold tracking-widest border border-neutral-700 text-neutral-400 px-1.5 sm:px-2 py-1 rounded-[3px] hover:border-white hover:text-white transition"
                      >
                        TODAY
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 text-center text-[13px] text-neutral-500 mb-2 font-bold w-full">
                      <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 w-full">
                      {Array.from({ length: currentMonthOffsetGap }).map((_, offsetIdx) => (
                        <div key={`offset-${offsetIdx}`} className="aspect-square"></div>
                      ))}
                      
                      {currentMonthDaysMatrix.map((dateStr, idx) => {
                        const isSelected = selectedDates.includes(dateStr);
                        const dayNum = idx + 1;
                        const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                        const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                        return (
                          <button
                            key={dateStr}
                            onClick={() => {
                              if (selectedDates.includes(dateStr)) {
                                setSelectedDates(selectedDates.filter(d => d !== dateStr));
                              } else {
                                setSelectedDates([...selectedDates, dateStr]);
                              }
                            }}
                            className={`aspect-square flex flex-col items-center justify-center text-[14px] transition duration-250 relative ${
                              isSelected 
                                ? 'bg-neutral-800 text-white font-bold' 
                                : 'bg-[#111] text-neutral-400 hover:text-white'
                            }`}
                          >
                            <span className={`${isSunday ? 'text-rose-500/80' : isSaturday ? 'text-blue-400/80' : ''}`}>{dayNum}</span>
                            {isSelected && (
                              <span className="w-1 h-1 rounded-full bg-white absolute bottom-1.5"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 mt-4 w-full">
                    <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold block mb-1">방장의 식사 의견 제시 (선택)</label>
                    <input 
                      type="text"
                      value={creatorInitialOpinion}
                      onChange={(e) => setCreatorFirstOpinion(e.target.value)}
                      placeholder="원하는 식사 메뉴나 의견을 남겨주세요"
                      className="premium-input w-full text-[14px]"
                    />
                  </div>
                </div>

                <button onClick={handleFinalizeRoom} className="w-full menu-btn mt-4">
                  <div className="menu-btn-inner text-[18px]">방 만들기</div>
                </button>
              </div>
            )}

            {/* VIEW 4: ROOM GENERATION SUCCESSFUL */}
            {view === 'room-success' && (
              <div className="space-y-6 flex flex-col justify-between flex-grow">
                <div className="text-center py-8 space-y-4">
                  <div className="flex items-center justify-center mx-auto mb-2">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-[20px] font-bold tracking-[0.1em] text-white">일정 생성 완료</h2>
                  <p className="text-[13px] text-neutral-400 leading-relaxed max-w-xs mx-auto">
                    동료들에게 아래 코드를 공유해 보세요.<br/>이 일정은 내 대시보드에 자동 저장됩니다.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#0a0a0a] border border-neutral-800 p-6 text-center space-y-3">
                    <span className="text-[11px] uppercase tracking-widest text-neutral-500 font-bold block">초대 코드</span>
                    <span className="text-[28px] font-bold tracking-[0.15em] font-luxury text-white font-mono block">
                      {createdRoomCode}
                    </span>
                    <div className="text-[13px] text-neutral-500 pt-2">
                      비밀번호: <span className="font-mono text-white font-bold">{tempRoomData?.password}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const dummy = document.createElement('textarea');
                      document.body.appendChild(dummy);
                      dummy.value = `[BABMOOKZA] 식사 일정 초대가 도착했습니다!\n초대 코드: ${createdRoomCode}\n비밀번호: ${tempRoomData?.password}`;
                      dummy.select();
                      document.execCommand('copy');
                      document.body.removeChild(dummy);
                      triggerToast("초대 정보가 클립보드에 복사되었습니다.");
                    }}
                    className="w-full menu-btn"
                  >
                    <div className="menu-btn-inner text-[16px]">초대 정보 복사하기</div>
                  </button>
                </div>

                <div className="pt-4 flex space-x-3 w-full">
                  <button 
                    onClick={() => {
                      setSelectedRoomId(createdRoomCode);
                      setScheduleTab('input');
                      setView('view-schedule');
                    }}
                    className="flex-1 bg-neutral-900 border border-neutral-700 text-white py-3 text-[14px] font-bold transition hover:bg-neutral-800"
                  >
                    내 일정 바로가기
                  </button>
                  <button 
                    onClick={() => setView('dashboard')}
                    className="flex-1 bg-black border border-neutral-800 text-neutral-400 hover:text-white py-3 text-[14px] font-bold transition"
                  >
                    대시보드 이동
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 6: STANDARD MEAL CALENDAR */}
            {view === 'view-schedule' && selectedRoom && (
              <div className="space-y-5 flex-grow">
                
                <div className="flex items-center justify-between p-3 sm:p-4 bg-[#0a0a0a] border border-neutral-800 gap-2 sm:gap-3">
                  <div className="flex-shrink-0">
                    <button onClick={() => setView('dashboard')} className="px-3 sm:px-3.5 py-2 bg-[#111] border border-neutral-700 text-white hover:border-neutral-400 transition flex items-center justify-center">
                      <span className="text-[11px] sm:text-[12px] font-bold font-luxury tracking-widest">BACK</span>
                    </button>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-neutral-400 font-bold block truncate">Active Table</span>
                    <h3 className="text-[13px] sm:text-[15px] font-bold text-white truncate">{selectedRoom.title}</h3>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 border-l border-neutral-800 pl-2 sm:pl-3">
                    <div className="flex items-center justify-end w-full space-x-1 sm:space-x-1.5 mb-0.5">
                      <span className="text-[9px] sm:text-[10px] text-neutral-500">코드</span>
                      <span className="text-[11px] sm:text-[12px] font-mono text-white font-bold">{selectedRoom.id}</span>
                    </div>
                    <div className="flex items-center justify-end w-full space-x-1 sm:space-x-1.5">
                      <span className="text-[9px] sm:text-[10px] text-neutral-500">비번</span>
                      <span className="text-[11px] sm:text-[12px] font-mono text-white font-bold tracking-[0.2em]">{selectedRoom.password}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-[#0a0a0a] p-1.5 border border-neutral-800 w-full">
                  <button 
                    onClick={() => { setScheduleTab('input'); setInputSelectedDates(selectedRoom.participants.find(p => p.id === currentUser.id)?.dates || []); }}
                    className={`py-3 text-[14px] font-bold tracking-wider transition ${
                      scheduleTab === 'input' 
                        ? 'bg-neutral-800 border border-neutral-600 text-white' 
                        : 'bg-transparent text-neutral-500 hover:text-white'
                    }`}
                  >
                    내 일정 입력
                  </button>
                  <button 
                    onClick={() => { setScheduleTab('check'); setCheckSelectedDate(''); }}
                    className={`py-3 text-[14px] font-bold tracking-wider transition ${
                      scheduleTab === 'check' 
                        ? 'bg-neutral-800 border border-neutral-600 text-white' 
                        : 'bg-transparent text-neutral-500 hover:text-white'
                    }`}
                  >
                    점심 일정 확인
                  </button>
                </div>

                <div className="bg-[#0a0a0a] p-4 border border-neutral-800 w-full">
                  <div className="relative flex justify-center items-center mb-4 w-full">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button onClick={handlePrevMonth} className="text-[14px] text-neutral-500 hover:text-white transition font-bold p-2">&lt;</button>
                      <div className="text-center text-[14px] sm:text-[15px] tracking-[0.1em] sm:tracking-[0.2em] font-luxury text-white font-bold uppercase w-[120px] sm:w-[140px]">
                        {new Date(currentYear, currentMonth - 1).toLocaleString('en-US', { month: 'long' })} {currentYear}
                      </div>
                      <button onClick={handleNextMonth} className="text-[14px] text-neutral-500 hover:text-white transition font-bold p-2">&gt;</button>
                    </div>
                    <button 
                      onClick={handleGoToday} 
                      className="absolute right-0 text-[9px] sm:text-[10px] font-luxury font-bold tracking-widest border border-neutral-700 text-neutral-400 px-1.5 sm:px-2 py-1 rounded-[3px] hover:border-white hover:text-white transition"
                    >
                      TODAY
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-neutral-500 mb-2 font-bold w-full">
                    <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 w-full">
                    {Array.from({ length: currentMonthOffsetGap }).map((_, offsetIdx) => (
                      <div key={`offset6-${offsetIdx}`} className="aspect-square"></div>
                    ))}
                    
                    {currentMonthDaysMatrix.map((dateStr, idx) => {
                      const dayNum = idx + 1;
                      const matchingUsers = scheduleTab === 'check' ? getDotsForDate(selectedRoom, dateStr) : [];
                      
                      const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                      const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                      const isFocused = scheduleTab === 'input' 
                        ? inputSelectedDates.includes(dateStr)
                        : checkSingleDate === dateStr;

                      const hasDots = matchingUsers.length > 0;
                      const isGoldenDay = promisingDates.some(pd => pd.date === dateStr);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => {
                            if (scheduleTab === 'input') {
                              if (inputSelectedDates.includes(dateStr)) {
                                setInputSelectedDates(inputSelectedDates.filter(d => d !== dateStr));
                              } else {
                                setInputSelectedDates([...inputSelectedDates, dateStr]);
                              }
                            } else {
                              setCheckSelectedDate(dateStr);
                            }
                          }}
                          className={`aspect-square flex flex-col items-center justify-between p-1.5 text-[14px] transition relative ${
                            isFocused 
                              ? 'bg-neutral-800 text-white font-bold shadow-inner' 
                              : isGoldenDay
                                ? 'bg-neutral-900 border border-neutral-500 text-white font-bold'
                                : 'bg-[#111] text-neutral-500 hover:text-white'
                          }`}
                        >
                          <span className={`${isSunday ? 'text-rose-500/80' : isSaturday ? 'text-blue-400/80' : ''}`}>{dayNum}</span>
                          <div className="flex justify-center items-center space-x-0.5 h-1.5 w-full">
                            {matchingUsers.slice(0, 4).map((user, dIdx) => (
                              <span key={dIdx} className={`w-1 h-1 rounded-full ${isGoldenDay ? 'white-micro-dot' : 'silver-micro-dot'}`}></span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TAB CONTENT 1: INPUT SCHEDULE */}
                {scheduleTab === 'input' && (
                  <div className="p-5 bg-[#0a0a0a] border border-neutral-800 animate-fade-in space-y-5">
                    <span className="text-[14px] font-bold tracking-wider text-white block">내 일정 제출하기</span>
                    <div className="space-y-4">
                      <div>
                        <span className="text-[11px] text-neutral-500 block uppercase font-bold mb-1">선택된 날짜</span>
                        <span className="text-[13px] text-white font-bold block max-w-full truncate">
                          {inputSelectedDates.length > 0 
                            ? inputSelectedDates
                                .sort((a,b) => new Date(a) - new Date(b))
                                .map(d => `${parseInt(d.split('-')[1])}월 ${parseInt(d.split('-')[2])}일`)
                                .join(', ') 
                            : '캘린더에서 가능한 일자들을 골라주세요.'
                          }
                        </span>
                      </div>

                      <div className="space-y-2 w-full">
                        <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold block">참여자 이름</label>
                        <div className="premium-input w-full text-[14px] bg-neutral-900 text-neutral-300 cursor-not-allowed">
                          {currentUser.name}
                        </div>
                      </div>

                      <div className="space-y-2 w-full">
                        <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold block">의견 입력 (선택)</label>
                        <input type="text" value={guestOpinion} onChange={(e) => setGuestOpinion(e.target.value)} placeholder="원하는 메뉴나 의견을 남겨주세요" className="premium-input w-full text-[14px]" />
                      </div>

                      <button
                        onClick={() => {
                          if (inputSelectedDates.length === 0) {
                            triggerToast("참석 가능한 날짜를 캘린더에서 최소 하나 이상 선택해 주세요.");
                            return;
                          }
                          handleGuestJoinSubmit(inputSelectedDates, guestOpinion);
                          setGuestOpinion('');
                        }}
                        className={`w-full text-[15px] font-bold py-3 tracking-widest uppercase transition border ${
                          inputSelectedDates.length > 0 
                            ? 'bg-white text-black border-white hover:bg-neutral-200' 
                            : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                        }`}
                      >
                        {inputSelectedDates.length > 0 ? '내 일정 업데이트' : '날짜를 먼저 선택해 주세요'}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 2: CHECK SCHEDULE */}
                {scheduleTab === 'check' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-5 bg-[#0a0a0a] border border-neutral-800 space-y-3">
                      <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold block">유력 일정 분석 리포트</span>
                      <div className="text-[13px]">
                        {promisingDates.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-neutral-300">현재 동료들이 가장 많이 선호하는 유력 일정입니다.</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {promisingDates.map((pd, index) => (
                                <span key={index} className="bg-neutral-800 border border-neutral-500 text-white px-3 py-1.5 font-bold">
                                  {parseInt(pd.date.split('-')[1])}월 {parseInt(pd.date.split('-')[2])}일 ({pd.count}명 선택)
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-neutral-500">아직 2명 이상 일정이 겹치는 식사 날짜가 없습니다.</p>
                        )}
                      </div>
                    </div>

                    <div className="p-5 bg-[#0a0a0a] border border-neutral-800 space-y-4">
                      <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                        <span className="text-[12px] uppercase tracking-widest text-neutral-400 font-bold">참석자 현황 상세</span>
                        <span className="text-[14px] text-white font-bold">
                          {checkSingleDate ? `${parseInt(checkSingleDate.split('-')[1])}월 ${parseInt(checkSingleDate.split('-')[2])}일` : '일정 선택 필요'}
                        </span>
                      </div>

                      {checkSingleDate ? (
                        <div>
                          {getParticipantsForDate(selectedRoom, checkSingleDate).length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {getParticipantsForDate(selectedRoom, checkSingleDate).map((participant, uIdx) => (
                                <div key={uIdx} className="p-4 bg-[#111] border border-neutral-800 flex flex-col space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className={`font-bold text-[14px] ${participant.id === currentUser.id ? 'text-white underline underline-offset-4' : 'text-neutral-300'}`}>
                                      {participant.name} {participant.id === currentUser.id && "(나)"}
                                    </span>
                                    <span className="text-[10px] text-black bg-white px-2 py-0.5 font-bold">참석</span>
                                  </div>
                                  <p className="text-[12px] text-neutral-400">의견: "{participant.comment}"</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[13px] text-neutral-600 text-center py-5">해당 날짜에 참석 가능한 동료가 없습니다.</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-neutral-500 text-center py-5">캘린더에서 조회할 날짜를 한 곳 터치해 주십시오.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 7: DEVELOPER MATCHING */}
            {view === 'dev-lunch-intro' && (
              <div className="space-y-5 flex-grow flex flex-col justify-between h-full">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => setView('dashboard')} className="px-3.5 py-2 bg-[#111] border border-neutral-700 text-white hover:border-neutral-400 transition flex items-center justify-center">
                      <span className="text-[12px] font-bold font-luxury tracking-widest">BACK</span>
                    </button>
                    <div>
                      <h3 className="text-[14px] font-bold text-white font-luxury tracking-widest uppercase">Developer Match</h3>
                      <p className="text-[11px] text-neutral-500">개발자와의 1:1 식사 예약</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] p-4 border border-neutral-800 w-full">
                  <div className="relative flex justify-center items-center mb-4 w-full">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button onClick={handlePrevMonth} className="text-[14px] text-neutral-500 hover:text-white transition font-bold p-2">&lt;</button>
                      <div className="text-center text-[14px] sm:text-[15px] tracking-[0.1em] sm:tracking-[0.2em] font-luxury text-white font-bold uppercase w-[120px] sm:w-[140px]">
                        {new Date(currentYear, currentMonth - 1).toLocaleString('en-US', { month: 'long' })} {currentYear}
                      </div>
                      <button onClick={handleNextMonth} className="text-[14px] text-neutral-500 hover:text-white transition font-bold p-2">&gt;</button>
                    </div>
                    <button onClick={handleGoToday} className="absolute right-0 text-[9px] sm:text-[10px] font-luxury font-bold tracking-widest border border-neutral-700 text-neutral-400 px-1.5 sm:px-2 py-1 rounded-[3px] hover:border-white hover:text-white transition">
                      TODAY
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-neutral-500 mb-2 font-bold w-full">
                    <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full">
                    {Array.from({ length: currentMonthOffsetGap }).map((_, offsetIdx) => (
                      <div key={`offset7-${offsetIdx}`} className="aspect-square"></div>
                    ))}
                    
                    {currentMonthDaysMatrix.map((dateStr, idx) => {
                      const dayNum = idx + 1;
                      const matchedBooking = devReservations.find(res => res.date === dateStr);
                      const isBlocked = matchedBooking && matchedBooking.userId === 'master-block';
                      const isUnavailable = DEV_UNAVAILABLE_DAYS.includes(dateStr);
                      const isSelected = devSelectedDate === dateStr;

                      const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                      const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                      const hasDot = !!matchedBooking && !isBlocked;
                      const isMyBooking = hasDot && matchedBooking.userId === currentUser.id; 

                      let cellBg = 'bg-[#111] border border-transparent';
                      let textColor = 'text-neutral-400';
                      let activeStyle = '';

                      if (isUnavailable) {
                        cellBg = 'bg-neutral-900 opacity-40 cursor-not-allowed border border-transparent';
                        textColor = 'text-neutral-600 line-through';
                      } else if (isBlocked) {
                        if (isDeveloper) {
                          cellBg = 'bg-rose-950/50 text-rose-400 font-bold border border-rose-800';
                          textColor = 'text-rose-400';
                        } else {
                          cellBg = 'bg-neutral-900 opacity-60 cursor-not-allowed border border-transparent';
                          textColor = 'text-neutral-600';
                        }
                      } else if (isSelected) {
                        cellBg = 'bg-neutral-800 text-white font-bold border border-transparent';
                        activeStyle = 'shadow-inner';
                      } else if (isMyBooking) {
                        cellBg = 'bg-[#111] text-white font-bold border border-[#a3a3a3] shadow-[0_0_6px_rgba(163,163,163,0.25)]'; 
                      } else if (hasDot) {
                        cellBg = 'bg-neutral-900 border border-transparent';
                      }

                      return (
                        <button
                          key={dateStr}
                          disabled={isUnavailable || (!isDeveloper && isBlocked)}
                          onClick={() => {
                            setDevSelectedDate(dateStr);
                          }}
                          className={`w-full aspect-square flex flex-col items-center justify-center p-0.5 sm:p-1.5 text-[12px] sm:text-[13px] transition overflow-hidden ${cellBg} ${textColor} ${activeStyle}`}
                        >
                          <span className={`${isSunday ? 'text-rose-500/80' : isSaturday ? 'text-blue-400/80' : ''}`}>{dayNum}</span>
                          
                          {isBlocked && isDeveloper && <span className="text-[8px] sm:text-[10px] text-rose-500 mt-0.5 leading-none font-bold">블락</span>}
                          {isBlocked && !isDeveloper && <span className="text-[8px] sm:text-[10px] text-neutral-600 mt-0.5 leading-none">불가</span>}
                          {isMyBooking && !isBlocked && <span className="text-[8px] sm:text-[10px] text-neutral-600 mt-0.5 leading-none">예약</span>}
                          {hasDot && !isMyBooking && !isBlocked && <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-neutral-500 mt-1"></span>}
                          {!hasDot && !isUnavailable && !isBlocked && <span className="text-[8px] sm:text-[10px] text-neutral-600 mt-0.5 leading-none">가능</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-[#0a0a0a] border border-neutral-800 w-full">
                  <div className="flex justify-between items-center mb-2 border-b border-neutral-800 pb-3">
                    <span className="text-[12px] text-neutral-400 font-bold uppercase tracking-wider">상세 일정 정보</span>
                    <span className="text-[14px] text-white font-bold">
                      {devSelectedDate ? `${parseInt(devSelectedDate.split('-')[1])}월 ${parseInt(devSelectedDate.split('-')[2])}일` : '선택 대기중'}
                    </span>
                  </div>

                  {devSelectedDate && (
                    <div className="text-[13px] mt-4">
                      {(() => {
                        const booking = devReservations.find(res => res.date === devSelectedDate);
                        
                        if (isDeveloper) {
                          if (!booking) {
                            return (
                              <div className="p-4 bg-neutral-900 border border-neutral-700 space-y-3">
                                <p className="text-white font-bold text-[14px]">일정 블락하기 (마스터)</p>
                                <input
                                  type="text"
                                  value={devBlockMemo}
                                  onChange={(e) => setDevBlockMemo(e.target.value)}
                                  placeholder="블락 사유 (예: 연차, 개인일정)"
                                  className="w-full bg-black border border-neutral-700 p-2.5 text-[13px] text-white outline-none focus:border-neutral-500"
                                />
                                <button 
                                  onClick={handleMasterBlockDate} 
                                  className="w-full py-2.5 bg-neutral-200 text-black font-bold border border-white hover:bg-white transition mt-2"
                                >
                                  이 날짜 블락하기
                                </button>
                              </div>
                            );
                          } else if (booking.userId === 'master-block') {
                            return (
                              <div className="p-4 bg-neutral-900 border border-neutral-700 space-y-3">
                                <p className="text-rose-400 font-bold text-[14px]">블락된 일정 (마스터)</p>
                                <p className="text-neutral-400">메모: <span className="text-white font-bold">{booking.memo}</span></p>
                                <button 
                                  onClick={() => handleCancelDevBooking(booking.id)} 
                                  className="w-full py-2.5 bg-black text-white font-bold border border-neutral-500 hover:bg-neutral-800 transition mt-2"
                                >
                                  블락 해제하기
                                </button>
                              </div>
                            );
                          } else {
                            return (
                              <div className="p-4 bg-neutral-900 border border-neutral-700 space-y-3">
                                <p className="text-white font-bold text-[14px]">예약자 관리 (마스터)</p>
                                <p className="text-neutral-300">신청인: <span className="font-bold text-white">{booking.nickname}</span> 님</p>
                                <p className="text-neutral-500 font-mono text-[11px]">생일(비번): {booking.birth}</p>
                                <button 
                                  onClick={() => handleCancelDevBooking(booking.id)} 
                                  className="w-full py-2.5 bg-neutral-200 text-black font-bold border border-white hover:bg-white transition mt-2"
                                >
                                  즉시 예약 취소 (관리자 권한)
                                </button>
                              </div>
                            );
                          }
                        } else {
                          if (!booking) {
                            return <span className="text-white font-bold">예약이 비어있습니다. 하단에서 신청이 가능합니다.</span>;
                          } else if (booking.userId === 'master-block') {
                            return (
                              <div className="p-4 bg-neutral-900 border border-neutral-700 space-y-2">
                                 <span className="text-rose-400 font-bold block">개발자 일정으로 인해 해당 날짜는 예약이 불가능합니다.</span>
                                 {booking.memo && <p className="text-neutral-400 text-[12px]">메모: {booking.memo}</p>}
                              </div>
                            );
                          } else if (booking.userId === currentUser.id) {
                            if (unlockedBookingIds.includes(booking.id)) {
                              return (
                                <div className="p-4 bg-neutral-900 border border-neutral-600 space-y-3">
                                  <p className="text-white font-bold">내 예약 관리</p>
                                  <button 
                                    onClick={() => handleCancelDevBooking(booking.id)} 
                                    className="w-full py-2.5 bg-neutral-800 text-white border border-neutral-500 hover:bg-neutral-700 font-bold transition"
                                  >
                                    약속 취소하기
                                  </button>
                                </div>
                              );
                            } else {
                              return (
                                <div className="space-y-3 p-2">
                                  <input 
                                    type="password" 
                                    placeholder="취소를 위해 생일 4자리 다시 입력" 
                                    maxLength="4"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-full bg-black border border-neutral-700 p-3 text-[14px] text-white focus:border-white outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (e.target.value === currentUser.birth) {
                                          setUnlockedBookingIds([...unlockedBookingIds, booking.id]);
                                          triggerToast("확인되었습니다. 취소 버튼이 활성화됩니다.");
                                        } else {
                                          triggerToast("생일 정보가 다릅니다.");
                                        }
                                      }
                                    }}
                                  />
                                  <p className="text-[11px] text-neutral-500">예약 취소를 원하시면 본인 비밀번호를 입력 후 엔터를 쳐주세요.</p>
                                </div>
                              );
                            }
                          } else {
                            return (
                              <span className="text-neutral-500 font-bold">선약이 있습니다. 다른 날짜를 선택해 주세요.</span>
                            );
                          }
                        }
                      })()}
                    </div>
                  )}
                </div>

                {!isDeveloper && (
                  <div className="p-5 bg-[#0a0a0a] border border-neutral-800 space-y-4 w-full">
                    <span className="text-[13px] font-bold tracking-wider text-white block uppercase">개발자의 식사 신청 </span>
                    <div className="space-y-4">
                      <div className="space-y-2 w-full">
                        <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold">신청자 이름</label>
                        <div className="premium-input w-full text-[14px] bg-neutral-900 text-neutral-400 cursor-not-allowed">
                          {currentUser.name}
                        </div>
                      </div>

                      <button
                        onClick={handleDevBookingSubmit}
                        disabled={!devSelectedDate || devReservations.some(res => res.date === devSelectedDate)}
                        className={`w-full py-3 text-[15px] font-bold uppercase tracking-wider transition border ${
                          !devSelectedDate || devReservations.some(res => res.date === devSelectedDate)
                            ? 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                            : 'bg-white text-black border-white hover:bg-neutral-200'
                        }`}
                      >
                        {devSelectedDate ? `${parseInt(devSelectedDate.split('-')[1])}월 ${parseInt(devSelectedDate.split('-')[2])}일 약속 신청` : '달력에서 일정을 터치하세요'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* GLOBAL FOOTER */}
      <div className="p-5 border-t border-neutral-900 bg-black text-center text-[12px] text-neutral-600 tracking-[0.12em] font-luxury uppercase select-none z-20 relative">
        <span className="py-2 block">© 2026 BABMOOKZA Luxury Concierge</span>
      </div>
    </div>
  );
}

export default App;