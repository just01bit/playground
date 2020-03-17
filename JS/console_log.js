function Person() {
  // The Person() constructor defines `this` as an instance of itself.
  this.age = 0;

  setInterval(function growUp() {
    // In non-strict mode, the growUp() function defines `this`
    // as the global object (because it's where growUp() is executed.), 
    // which is different from the `this`
    // defined by the Person() constructor.
    var ageNow = this.age++;
    console.log(this.ageNow);
  }, 1000);
}

var p = new Person();