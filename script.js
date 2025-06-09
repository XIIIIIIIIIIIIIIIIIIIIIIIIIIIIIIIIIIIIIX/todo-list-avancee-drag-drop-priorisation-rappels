
    const todoListEl = document.getElementById('todo-list');
    const form = document.getElementById('add-form');
    const titleInput = document.getElementById('title');
    const reminderInput = document.getElementById('reminder');
    const priorityInput = document.getElementById('priority');
    const reminderSound = document.getElementById('reminder-sound');
    let todos = [];
    let dragSrcIndex = null;
    let reminderIntervals = {};

    // Set min date for datetime-local input (= now)
    function pad0(n){return n<10?'0'+n:n;}
    function toLocalDatetimeString(date){
      return date.getFullYear()+'-'+pad0(date.getMonth()+1)+'-'+pad0(date.getDate())+'T'+pad0(date.getHours())+':'+pad0(date.getMinutes());
    }
    reminderInput.min = toLocalDatetimeString(new Date());

    // Restore todos from localStorage
    if(localStorage.getItem('advanced_todos')){
      todos = JSON.parse(localStorage.getItem('advanced_todos'));
    }
    renderTodos();

    function saveTodos(){
      localStorage.setItem('advanced_todos', JSON.stringify(todos));
    }

    // Add Todo
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const title = titleInput.value.trim();
      if(!title) return;

      let reminder = reminderInput.value ? (new Date(reminderInput.value)).toISOString() : null;
      const now = new Date();

      if(reminder && new Date(reminder) < now){
        alert('La date de rappel doit être dans le futur.');
        return;
      }

      const todo = {
        id: Date.now() + '_' + Math.random().toString(36).slice(2),
        title,
        completed: false,
        priority: priorityInput.value,
        reminder,
        reminderNotified: false,
        order: todos.length
      };
      todos.push(todo);
      saveTodos();
      renderTodos();
      form.reset();
      priorityInput.value='medium';
    });

    // Render Todos
    function renderTodos(){
      // Sort by order property
      todos.sort((a,b)=> a.order - b.order);
      todoListEl.innerHTML = '';
      todos.forEach((todo, idx)=>{
        const li = document.createElement('li');
        li.className = 'todo-item priority-' + todo.priority + (todo.completed ? ' checked' : '');
        li.draggable = true;
        li.dataset.idx = idx;
        li.dataset.id = todo.id;

        // Content
        const content = document.createElement('div');
        content.className = 'todo-content';

        // Title
        const title = document.createElement('span');
        title.className = 'todo-title';
        title.textContent = todo.title;
        content.appendChild(title);

        // Details row
        const details = document.createElement('div');
        if(todo.reminder){
          const reminder = document.createElement('span');
          reminder.className = 'todo-reminder';
          reminder.innerHTML = '<span class="reminder-badge">⏰ ' + formatDateTime(todo.reminder) + '</span>';
          details.appendChild(reminder);
        }
        const prior = document.createElement('span');
        prior.className = 'todo-priority';
        prior.innerText = getPriorityLabel(todo.priority);
        details.appendChild(prior);
        content.appendChild(details);

        li.appendChild(content);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'actions';

        const doneBtn = document.createElement('button');
        doneBtn.title = 'Valider';
        doneBtn.innerHTML = todo.completed ? '✅' : '☑️';
        doneBtn.addEventListener('click', function(){
          todo.completed = !todo.completed;
          saveTodos();
          renderTodos();
        });
        actions.appendChild(doneBtn);

        const delBtn = document.createElement('button');
        delBtn.title = 'Supprimer';
        delBtn.innerHTML = '🗑️';
        delBtn.addEventListener('click', function(){
          if(confirm('Supprimer cette tâche ?')){
            todos = todos.filter(t=>t.id!==todo.id);
            saveTodos();
            renderTodos();
          }
        });
        actions.appendChild(delBtn);

        li.appendChild(actions);

        // Drag & Drop
        li.addEventListener('dragstart', function(e){
          dragSrcIndex = idx;
          li.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        li.addEventListener('dragend', function(){
          li.classList.remove('dragging');
        });
        li.addEventListener('dragover', function(e){
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        li.addEventListener('drop', function(e){
          e.stopPropagation();
          const toIdx = +li.dataset.idx;
          moveTodo(dragSrcIndex, toIdx);
        });

        todoListEl.appendChild(li);
      });
      setupReminderChecks();
    }

    function moveTodo(from, to){
      if(from===to) return;
      const moved = todos.splice(from,1)[0];
      todos.splice(to, 0, moved);
      // Refresh orders
      todos.forEach((t,i)=> t.order=i);
      saveTodos();
      renderTodos();
    }

    function getPriorityLabel(p){
      switch(p){
        case 'high': return 'Priorité haute';
        case 'medium': return 'Priorité moyenne';
        case 'low': return 'Priorité faible';
        default: return '-';
      }
    }
    function formatDateTime(dt){
      const d = new Date(dt);
      return pad0(d.getDate()) + '/' + pad0(d.getMonth()+1) + ' ' + pad0(d.getHours()) + ':' + pad0(d.getMinutes());
    }

    // Reminders system
    function setupReminderChecks(){
      // Clear previous intervals
      Object.values(reminderIntervals).forEach(clearTimeout);
      reminderIntervals = {};
      todos.forEach((todo, i)=>{
        if(todo.reminder && !todo.completed && !todo.reminderNotified){
          const now = Date.now();
          const remindTime = (new Date(todo.reminder)).getTime();
          if(remindTime <= now){
            triggerReminder(todo);
          } else {
            // Set timeout for reminder
            const ms = remindTime - now;
            reminderIntervals[todo.id] = setTimeout(()=> triggerReminder(todo), ms+100);
          }
        }
      });
    }
    function triggerReminder(todo){
      if(todo.reminderNotified || todo.completed) return;
      todo.reminderNotified = true;
      saveTodos();
      renderTodos();
      // Show notification if possible
      if(Notification && Notification.permission==='granted'){
        new Notification('Rappel: '+todo.title, {
          body: 'Il est temps : '+formatDateTime(todo.reminder),
          icon: 'https://cdn-icons-png.flaticon.com/512/2919/2919600.png'
        });
      } else {
        alert('⏰ Rappel : ' + todo.title + '\n' + formatDateTime(todo.reminder));
      }
      reminderSound.currentTime = 0;
      reminderSound.play().catch(()=>{});
    }
    // Request notification permission
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // Restore dragndrop functionality for touch devices
    let touchDragIdx = null, touchOverIdx = null;
    todoListEl.addEventListener('touchstart', function(e){
      const li = e.target.closest('.todo-item');
      if(!li) return;
      touchDragIdx = +li.dataset.idx;
    }, {passive:true});
    todoListEl.addEventListener('touchmove', function(e){
      const touch = e.touches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if(elem){
        const li = elem.closest('.todo-item');
        if(li) touchOverIdx = +li.dataset.idx;
      }
    }, {passive:true});
    todoListEl.addEventListener('touchend', function(){
      if(touchDragIdx!==null && touchOverIdx!==null && touchDragIdx!==touchOverIdx){
        moveTodo(touchDragIdx, touchOverIdx);
      }
      touchDragIdx = touchOverIdx = null;
    });

    // Accessibility: Enter submits form; Up/Down move focus in list
    todoListEl.addEventListener('keydown', function(e){
      const items = Array.from(todoListEl.querySelectorAll('.todo-item'));
      const idx = items.indexOf(document.activeElement);
      if(idx<0) return;
      if(e.key==='ArrowDown' && idx<items.length-1){
        e.preventDefault(); items[idx+1].focus();
      }
      if(e.key==='ArrowUp' && idx>0){
        e.preventDefault(); items[idx-1].focus();
      }
    });
    // Give tab-focus to todo items
    new MutationObserver(()=> {
      todoListEl.querySelectorAll('.todo-item').forEach(li=>li.tabIndex=0);
    }).observe(todoListEl,{childList:true,subtree:false});