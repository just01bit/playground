var elements = [
    'Hydrogen',
    'Helium',
    'Lithium',
    'Beryllium'
  ];

 var mapLength = elements.map(({ length: lengthFooBArX }) => lengthFooBArX); // [8, 6, 7, 9]
 console.log(mapLength);