from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship



class Shop(db.Model):
    __tablename__= "shops"

    shop_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    shop_name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    shop_image = db.Column(db.Text, nullable=True)
    shop_address_street = db.Column(db.Text, nullable=False)
    shop_address_province = db.Column(db.String(120), nullable=False)
    shop_address_city = db.Column(db.String(120),nullable=False)
    shop_address_district = db.Column(db.String(120), nullable=False)
    shop_address_subdistrict = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    user_id = db.Column(db.Integer, ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    shop_email  = db.Column(db.String(120), nullable=True)
    shop_phone_number = db.Column(db.String(15), nullable=True)
    shop_zip_code = db.Column(db.String(255), nullable=True)


    user = relationship("User", back_populates="shop", lazy=True)

    product = relationship("Product", back_populates="shop", cascade="all, delete", lazy=True)

    def __repr__(self):
        return f'<Shop {self.shop_id} {self.shop_name} {self.description} {self.created_at}>'
    

    def to_dict(self):
        return {
            'shop_id': self.shop_id,
            'shop_name': self.shop_name,
            'description': self.description,
            'shop_image': self.shop_image,
            'shop_address_street': self.shop_address_street,
            'shop_address_province': self.shop_address_province,
            'shop_address_city': self.shop_address_city,
            'shop_address_district': self.shop_address_district,
            'shop_address_subdistrict': self.shop_address_subdistrict,
            'created_at': self.created_at,
            'user_id': self.user_id,
            'status': self.status,
            'shop_email': self.shop_email,
            'shop_phone_number': self.shop_phone_number,
            'shop_zip_code': self.shop_zip_code
        }



    
