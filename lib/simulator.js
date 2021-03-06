var Emitter = require('eventemitter2').EventEmitter2;
var onFrame = require('./frame').onFrame;
var Accumulator = require('./accumulator');

function Simulator(options) {
  if (!(this instanceof Simulator)) return new Simulator(options);

  Emitter.call(this);

  options = options || {};
  this._step = this._step.bind(this);
  this._stepInterval = 1000 / 60;     // TODO: option
  this._running = false;
  this._accumulator = undefined;
  this._particles = [];
  this._bodies = [];
  this._forces = [];
  this._constraints = [];
  this._priorities = options.solve || [];
  this._iterations = 10;             // TODO: option
}

Simulator.prototype = Object.create(Emitter.prototype);

Simulator.prototype.start = function() {
  this._running = true;
  this._accumulator = new Accumulator(this._stepInterval, 100);
  onFrame(this._step);
};

Simulator.prototype.add = function(entity) {
  if (entity.type === 'Particle') this._particles.push(entity);
  else if (entity.type === 'Force') this._forces.push(entity);
  else if (entity.type === 'Constraint') {
    entity.setPriority(this._priorities);
    this._constraints.push(entity);
    this._constraints.sort(prioritySort);
  }
  else if (entity.type === 'Body') {
    this._bodies.push(entity);
    entity.setSimulator(this);
  }
  return entity;
};

Simulator.prototype.findNearest = function(point, radius) {
  var nearestDistance = radius * radius;
  var nearest, distance;

  for (var i = 0; i < this._particles.length; i++) {
    distance = this._particles[i].position.getDistance2(point);
    if (distance < nearestDistance) {
      nearest = this._particles[i];
      nearestDistance = distance;
    }
  }
  return nearest;
};

Simulator.prototype.getParticles = function() {
  return this._particles;
};

Simulator.prototype.remove = function(entity) {
  if (entity.type === 'Constraint') {
    var index = this._constraints.indexOf(entity);
    if (index === -1) throw new Error('entity not found');
    this._constraints.splice(index, 1);
  }
};

Simulator.prototype._step = function() {
  if (!this._running) return;

  var time;
  var interval = this._accumulator.freeze();
  while (time = this._accumulator.next()) {
    this._simulate(interval, time);
  }

  onFrame(this._step);
};

Simulator.prototype._simulate = function(time, totalTime) {
  this._cull();
  this._integrate(time);
  this._constrain(time);
};

Simulator.prototype._cull = function() {
  var i = 0;
  while (i < this._constraints.length) {
    if (this._constraints[i]._deleted) {
      this._constraints.splice(i, 1);
    }
    else i++;
  }
};

Simulator.prototype._integrate = function(time) {
  var particles = this._particles;
  var forces = this._forces;
  var particle, force;

  for (var p = 0; p < particles.length; p++) {
    particle = particles[p];
    for (var f = 0; f < forces.length; f++) {
      force = forces[f];
      force.applyTo(particle);
    }
    particle.integrate(time);
  }
};

Simulator.prototype._constrain = function(time) {
  var constraints = this._constraints;
  var particles = this._particles;

  for (var i = 0; i < this._iterations; i++) {
    for (var c = 0; c < constraints.length; c++) {
      constraints[c].correct(time, particles, i, this._iterations);
    }
  }

  for (var c = 0; c < constraints.length; c++) {
    constraints[c].evaluate(time, particles);
  }
};

module.exports = Simulator;

function prioritySort(a, b) {
  return b.priority - a.priority || b.id - a.id;
}

